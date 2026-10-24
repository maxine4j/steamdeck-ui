import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Diagnostics } from "./diagnostics";
import { ErrorContextClient } from "./error-context-client";
import { EventLogClient } from "./event-log-client";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.stubGlobal("issecretvalue", () => false));

function setup() {
	const delayed: (() => void)[] = [];
	const scheduler = {
		nextFrame: vi.fn(() => () => {}),
		delay: vi.fn((_seconds: number, callback: () => void) => {
			delayed.push(callback);
			return () => {
				delayed.splice(delayed.indexOf(callback), 1);
			};
		}),
	};
	const diagnostics = new Diagnostics(() => 100);
	const context = {
		capture: vi.fn(() => ({
			buildCommit: "test",
			details: {
				zone: "Dornogal",
				inInstance: true,
				instanceType: "party",
				difficultyID: 2,
				inLFGGroup: true,
				instanceParty: true,
				combatLockdown: true,
				restrictionEncounter: 2,
			},
			unavailableFields: [],
		})),
	};
	return {
		diagnostics,
		context,
		delayed,
		client: new EventLogClient(diagnostics, context, scheduler),
	};
}

it("records application payloads, native fields and the NPC separately from the target", () => {
	vi.stubGlobal("UnitName", (unit: string) => [
		unit === "npc" ? "Quest Giver" : "Training Dummy",
		"Realm",
	]);
	vi.stubGlobal("UnitGUID", (unit: string) => `Creature-${unit}`);
	vi.stubGlobal("GetQuestID", () => 42);
	vi.stubGlobal("GetTitleText", () => "An adventure");
	const { client, diagnostics } = setup();
	client.application("NAV_DIRECTION_CHANGED", {
		direction: "left",
		pressed: true,
	});
	client.native("QUEST_DETAIL", [123]);
	client.native("PLAYER_TARGET_CHANGED", []);
	expect(diagnostics.report()).toContain("direction=left");
	expect(diagnostics.report()).toContain("pressed=true");
	expect(diagnostics.report()).toContain("startItem=123");
	expect(diagnostics.report()).toContain("npcName=Quest Giver");
	expect(diagnostics.report()).toContain("targetName=Training Dummy");
	expect(diagnostics.report()).toContain("npcGUID=Creature-npc");
	expect(diagnostics.report()).toContain("questID=42");
	expect(diagnostics.report()).toContain("questTitle=An adventure");
});

it("records world, group, combat and restriction transitions with current environment", () => {
	const { client, diagnostics, context } = setup();
	for (const event of [
		"PLAYER_ENTERING_WORLD",
		"ZONE_CHANGED",
		"ZONE_CHANGED_INDOORS",
		"ZONE_CHANGED_NEW_AREA",
		"GROUP_JOINED",
		"LFG_PROPOSAL_SUCCEEDED",
		"PLAYER_REGEN_DISABLED",
		"ADDON_RESTRICTION_STATE_CHANGED",
		"ADDON_ACTION_BLOCKED",
		"ENCOUNTER_START",
		"CHALLENGE_MODE_START",
	])
		client.native(event, [1, 2]);
	expect(context.capture).toHaveBeenCalledTimes(11);
	expect(diagnostics.report()).toContain("zone=Dornogal");
	expect(diagnostics.report()).toContain("inLFGGroup=true");
	expect(diagnostics.report()).toContain("restrictionEncounter=2");
	expect(diagnostics.report()).toContain("state=2");
});

it("snapshots every non-header quest at login, retries an initially empty log and logs quest lifecycle IDs and rewards", () => {
	const info = vi.fn((index: number) =>
		[
			undefined,
			{ isHeader: true, title: "Zone" },
			{ questID: 42, title: "First quest", level: 80, isHidden: false },
			{ questID: 43, title: "Hidden quest", isHidden: true },
		].at(index),
	);
	const entries = vi.fn(() => [0, 0]);
	vi.stubGlobal("C_QuestLog", {
		GetNumQuestLogEntries: entries,
		GetInfo: info,
		GetTitleForQuestID: (id: number) =>
			id === 42 ? "First quest" : "Hidden quest",
	});
	const { client, diagnostics } = setup();
	client.native("PLAYER_LOGIN", []);
	entries.mockReturnValue([3, 2]);
	client.native("QUEST_LOG_UPDATE", []);
	client.native("QUEST_LOG_UPDATE", []);
	expect(info).toHaveBeenCalledTimes(3);
	expect(diagnostics.report()).toContain("quest snapshot");
	expect(diagnostics.report()).toContain("title=First quest");
	expect(diagnostics.report()).toContain("title=Hidden quest");
	expect(diagnostics.report()).not.toContain("title=Zone");
	client.native("QUEST_ACCEPTED", [42]);
	client.native("QUEST_REMOVED", [42, false]);
	client.native("QUEST_TURNED_IN", [42, 100, 500]);
	expect(diagnostics.report()).toContain("native QUEST_ACCEPTED questID=42");
	expect(diagnostics.report()).toContain(
		"native QUEST_REMOVED questID=42 wasReplayQuest=false",
	);
	expect(diagnostics.report()).toContain("xpReward=100 moneyReward=500");
});

it("records an explicit decline using the offered quest even after Blizzard clears the dialog", () => {
	let decline = () => {};
	vi.stubGlobal("hooksecurefunc", (_name: string, callback: () => void) => {
		decline = callback;
	});
	vi.stubGlobal("GetQuestID", () => 42);
	vi.stubGlobal("GetTitleText", () => "Offered quest");
	const { client, diagnostics } = setup();
	client.initialize();
	client.initialize();
	client.native("QUEST_DETAIL", []);
	vi.stubGlobal("GetQuestID", () => 0);
	decline();
	expect(diagnostics.report()).toContain(
		"quest declined questID=42 questTitle=Offered quest",
	);
	vi.stubGlobal("GetQuestID", () => 91);
	vi.stubGlobal("GetTitleText", () => "Reward quest");
	client.native("QUEST_COMPLETE", []);
	decline();
	expect(diagnostics.report()).toContain(
		"quest declined questID=91 questTitle=Reward quest",
	);
});

it("redacts secrets, bounds nested payloads and survives unavailable game APIs", () => {
	const secret = {
		toString: () => {
			throw Error("secret inspected");
		},
	};
	vi.stubGlobal("issecretvalue", (value: unknown) => value === secret);
	vi.stubGlobal("UnitName", () => [secret]);
	vi.stubGlobal("GetQuestID", () => {
		throw Error("unavailable");
	});
	const { client, diagnostics } = setup();
	const cycle: Record<string, unknown> = {};
	cycle.self = cycle;
	expect(() => {
		client.application("DIALOGUE_ERROR", { message: secret });
		client.application("nested", cycle);
		client.native("QUEST_DETAIL", [secret]);
	}).not.toThrow();
	expect(diagnostics.report()).toContain("message=<secret>");
	expect(diagnostics.report()).toContain("npcName=<secret>");
	expect(diagnostics.report()).toContain("questID=<unavailable>");
	expect(diagnostics.report().length).toBeLessThan(5000);
});

it("dumps all payload fields recursively instead of selecting a few fields or shallow levels", () => {
	const { client, diagnostics } = setup();
	const payload: Record<string, unknown> = {};
	for (let index = 0; index < 30; index++) payload[`field${index}`] = index;
	payload.nested = { deeper: { deepest: { value: "retained" } } };
	payload.longText = "x".repeat(800);
	client.application("arbitrary", payload);
	client.native("arbitrary", [
		payload,
		...Array.from({ length: 25 }, (_, index) => index),
	]);
	expect(diagnostics.report()).toContain("field29=29");
	expect(diagnostics.report()).toContain("value=retained");
	expect(diagnostics.report()).toContain("x".repeat(800));
	expect(diagnostics.report()).toContain("arg26=24");
});

it("preserves large payload tails in continuation records and marks cycles and truncation", () => {
	const lines: string[] = [];
	const client = new EventLogClient(
		new Diagnostics(
			() => 100,
			500,
			(line) => lines.push(line),
		),
		{
			capture: () => ({
				buildCommit: "test",
				details: {},
				unavailableFields: [],
			}),
		},
		{ nextFrame: vi.fn(), delay: vi.fn() },
	);
	client.application("large", { text: `${"x".repeat(25000)}TAIL` });
	expect(lines).toHaveLength(3);
	expect(lines.at(-1)).toContain("part=3/3");
	expect(lines.at(-1)).toContain("TAIL");
	client.application("huge", "x".repeat(110000));
	expect(lines.at(-1)).toContain("<truncated: 100000 character limit>");
	const cycle: Record<string, unknown> = {};
	cycle.self = cycle;
	client.application("cycle", cycle);
	expect(lines.at(-1)).toContain("<cycle>");
});

it("records an unavailable placeholder if an entire payload table cannot be inspected", () => {
	const { client, diagnostics } = setup();
	const blocked = new Proxy(
		{},
		{
			ownKeys: () => {
				throw Error("protected table");
			},
		},
	);
	expect(() => client.application("blocked", blocked)).not.toThrow();
	expect(diagnostics.report()).toContain("<unavailable>");
});

it("isolates context, serialization, persistence and hook failures without recursive logging", () => {
	const { client, context, diagnostics } = setup();
	context.capture.mockImplementation(() => {
		throw Error("context failed");
	});
	expect(() => client.native("ZONE_CHANGED", [42])).not.toThrow();
	expect(diagnostics.report()).toContain("native ZONE_CHANGED arg1=42");
	expect(diagnostics.report()).toContain("environment=<unavailable>");
	vi.stubGlobal("issecretvalue", () => {
		throw Error("secret check failed");
	});
	expect(() => client.application("broken", "payload")).not.toThrow();
	vi.stubGlobal("issecretvalue", () => false);
	const log = vi.spyOn(diagnostics, "log").mockImplementation(() => {
		client.application("recursive", "payload");
		throw Error("persistence failed");
	});
	expect(() => client.native("arbitrary", [])).not.toThrow();
	expect(log).toHaveBeenCalledOnce();
	let decline = () => {};
	const hook = vi.fn((_name: string, _callback: () => void) => {
		throw Error("hook failed");
	});
	vi.stubGlobal("hooksecurefunc", hook);
	expect(() => client.initialize()).not.toThrow();
	hook.mockImplementation((_name, callback) => {
		decline = callback;
	});
	client.initialize();
	expect(hook).toHaveBeenCalledTimes(2);
	expect(() => decline()).not.toThrow();
});

it("keeps quest identity and relevant state without dumping unrelated API fields", () => {
	vi.stubGlobal("C_QuestLog", {
		GetNumQuestLogEntries: () => [1, 1],
		GetInfo: () => ({
			questID: 42,
			title: "Long quest",
			isHidden: true,
			isAutoComplete: false,
			details: `${"x".repeat(20000)}QUEST_TAIL`,
		}),
	});
	const { client, diagnostics } = setup();
	client.native("PLAYER_LOGIN", []);
	expect(diagnostics.report()).toContain(
		"questID=42 title=Long quest isHidden=true isAutoComplete=false",
	);
	expect(diagnostics.report()).not.toContain("QUEST_TAIL");
	expect(diagnostics.report()).not.toContain("details=");
});

it("samples successful item loads once, summarizes the tail, and preserves every failure", () => {
	const { client, diagnostics, delayed } = setup();
	for (let id = 1; id <= 53; id++) {
		client.native("ITEM_DATA_LOAD_RESULT", [id, true]);
		client.application("ITEM_DATA_LOAD_RESULT", { id, success: true });
	}
	client.native("ITEM_DATA_LOAD_RESULT", [99, false]);
	client.application("ITEM_DATA_LOAD_RESULT", { id: 99, success: false });
	expect(delayed).toHaveLength(1);
	delayed.shift()?.();
	const lines = diagnostics.report().split("\n");
	expect(
		lines.filter((line) => line.includes("event ITEM_DATA_LOAD_RESULT")),
	).toHaveLength(0);
	expect(
		lines.filter((line) => line.includes("native ITEM_DATA_LOAD_RESULT")),
	).toHaveLength(3);
	expect(diagnostics.report()).toContain("arg1=1 arg2=true");
	expect(diagnostics.report()).toContain("arg1=50 arg2=true");
	expect(diagnostics.report()).toContain("arg1=99 arg2=false");
	expect(diagnostics.report()).toContain(
		"item load summary successes=53 suppressed=51",
	);
});

it("flushes item-load counts on logout without repeating the delayed summary", () => {
	const { client, diagnostics, delayed } = setup();
	client.native("ITEM_DATA_LOAD_RESULT", [1, true]);
	client.native("ITEM_DATA_LOAD_RESULT", [2, true]);
	client.native("PLAYER_LOGOUT", []);
	expect(diagnostics.report()).toContain(
		"item load summary successes=2 suppressed=1",
	);
	expect(delayed).toHaveLength(0);
});

it("omits selected refresh notifications while retaining panel and input breadcrumbs", () => {
	const { client, diagnostics } = setup();
	for (const event of [
		"ACTION_RING_CONTENTS_CHANGED",
		"BAG_VISIBILITY_CHANGED",
		"TALENTS_VISIBILITY_CHANGED",
		"SPELLBOOK_VISIBILITY_CHANGED",
	])
		client.application(event);
	client.application("NAV_DOWN");
	client.application("NAV_DIRECTION_CHANGED", {
		direction: "down",
		pressed: true,
	});
	expect(diagnostics.report().split("\n")).toHaveLength(2);
	expect(diagnostics.report()).toContain("event NAV_DOWN");
	expect(diagnostics.report()).toContain("direction=down");
});

it("keeps LFG result IDs without recapturing the environment", () => {
	const { client, diagnostics, context } = setup();
	client.native("LFG_LIST_SEARCH_RESULT_UPDATED", [8]);
	expect(diagnostics.report()).toContain(
		"native LFG_LIST_SEARCH_RESULT_UPDATED resultID=8",
	);
	expect(context.capture).not.toHaveBeenCalled();
});

it("captures context for major situation changes but not routine addon, roster or LFG refreshes", () => {
	const { client, context, diagnostics } = setup();
	for (const event of [
		"ADDON_LOADED",
		"GROUP_ROSTER_UPDATE",
		"LFG_UPDATE",
		"LFG_LIST_SEARCH_RESULTS_RECEIVED",
		"LFG_LIST_SEARCH_RESULT_UPDATED",
		"CHALLENGE_MODE_MAPS_UPDATE",
		"ENCOUNTER_LOOT_RECEIVED",
	])
		client.native(event, [8]);
	expect(context.capture).not.toHaveBeenCalled();
	expect(diagnostics.report()).toContain("native ADDON_LOADED arg1=8");
	for (const event of [
		"PLAYER_ENTERING_WORLD",
		"ZONE_CHANGED_NEW_AREA",
		"PLAYER_DIFFICULTY_CHANGED",
		"GROUP_JOINED",
		"GROUP_LEFT",
		"LFG_PROPOSAL_SUCCEEDED",
		"ENCOUNTER_START",
		"ENCOUNTER_END",
		"CHALLENGE_MODE_START",
		"CHALLENGE_MODE_COMPLETED",
		"CHALLENGE_MODE_RESET",
		"PLAYER_REGEN_DISABLED",
		"PLAYER_REGEN_ENABLED",
		"ADDON_RESTRICTION_STATE_CHANGED",
		"ADDON_ACTION_BLOCKED",
		"ADDON_ACTION_FORBIDDEN",
	])
		client.native(event, []);
	expect(context.capture).toHaveBeenCalledTimes(16);
});

it("captures LFG membership, instance party and restriction states in error environments", () => {
	vi.stubGlobal("_G", {
		IsPartyLFG: () => true,
		LE_PARTY_CATEGORY_INSTANCE: 2,
		IsInGroup: (category?: number) => category === 2,
		C_RestrictedActions: {
			GetAddOnRestrictionState: (type: number) => (type === 1 ? 2 : 0),
		},
		Enum: { AddOnRestrictionType: { Combat: 0, Encounter: 1 } },
	});
	expect(new ErrorContextClient().capture().details).toMatchObject({
		inLFGGroup: true,
		instanceParty: true,
		restrictionCombat: 0,
		restrictionEncounter: 2,
	});
});
