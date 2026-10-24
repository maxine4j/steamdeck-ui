import { afterEach, expect, it, vi } from "vitest";
import { ObjectiveTrackerClient } from "./objective-tracker-client";

afterEach(() => vi.unstubAllGlobals());

it("cycles displayed quest blocks in tracker order, wraps, and ignores stale and nonquest blocks", () => {
	const campaign = {
		firstBlock: { id: 30, nextBlock: { id: 31, cached: true } },
	};
	const quests = { firstBlock: { id: 20, nextBlock: { id: 10 } } };
	const world = { firstBlock: { id: 40 } };
	const bonus = { firstBlock: { id: -1, nextBlock: { id: 50 } } };
	vi.stubGlobal("CampaignQuestObjectiveTracker", campaign);
	vi.stubGlobal("QuestObjectiveTracker", quests);
	vi.stubGlobal("WorldQuestObjectiveTracker", world);
	vi.stubGlobal("BonusObjectiveTracker", bonus);
	vi.stubGlobal("ObjectiveTrackerFrame", {
		modules: [campaign, { firstBlock: { id: 999 } }, quests, world, bonus],
	});
	let current = 0;
	const select = vi.fn((id: number) => {
		current = id;
	});
	vi.stubGlobal("C_SuperTrack", {
		GetSuperTrackedQuestID: () => current,
		SetSuperTrackedQuestID: select,
	});
	const client = new ObjectiveTrackerClient();
	for (let i = 0; i < 6; i++) client.selectNext();
	expect(select.mock.calls.map(([id]) => id)).toEqual([30, 20, 10, 40, 50, 30]);
	current = 999;
	client.selectNext();
	expect(current).toBe(30);
});

it("leaves empty trackers alone and never deselects a single objective", () => {
	const quests = { firstBlock: undefined as { id: number } | undefined };
	vi.stubGlobal("QuestObjectiveTracker", quests);
	vi.stubGlobal("CampaignQuestObjectiveTracker", undefined);
	vi.stubGlobal("WorldQuestObjectiveTracker", undefined);
	vi.stubGlobal("BonusObjectiveTracker", undefined);
	vi.stubGlobal("ObjectiveTrackerFrame", { modules: [quests] });
	const select = vi.fn();
	vi.stubGlobal("C_SuperTrack", {
		GetSuperTrackedQuestID: () => 10,
		SetSuperTrackedQuestID: select,
	});
	const client = new ObjectiveTrackerClient();
	client.selectNext();
	expect(select).not.toHaveBeenCalled();
	quests.firstBlock = { id: 10 };
	client.selectNext();
	expect(select).toHaveBeenCalledExactlyOnceWith(10);
});

it("uses the standard tracker collapse toggle and tolerates an unavailable tracker", () => {
	const toggle = vi.fn();
	vi.stubGlobal("ObjectiveTrackerFrame", { ToggleCollapsed: toggle });
	const client = new ObjectiveTrackerClient();
	client.toggle();
	expect(toggle).toHaveBeenCalledOnce();
	vi.stubGlobal("ObjectiveTrackerFrame", undefined);
	expect(() => {
		client.toggle();
		client.selectNext();
	}).not.toThrow();
});
