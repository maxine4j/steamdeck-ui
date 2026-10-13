import { afterEach, expect, it, vi } from "vitest";
import { DungeonFinderClient } from "./dungeon-finder-client";

afterEach(() => vi.unstubAllGlobals());

function setupRaids(queuedCount = 0) {
	setup();
	vi.stubGlobal("GetServerExpansionLevel", () => 10);
	vi.stubGlobal("GetNumRFDungeons", () => 4);
	vi.stubGlobal("GetLFGDungeonNumEncounters", () => 2);
	vi.stubGlobal("GetLFGDungeonEncounterInfo", (id: number, index: number) => [
		`Boss ${id}.${index}`,
		0,
		index === 1,
	]);
	vi.stubGlobal("GetRFDungeonInfo", (index: number) => {
		const info: (string | number)[] = [];
		info[0] = 100 + index;
		info[1] = `Wing ${index}`;
		info[9] = 10;
		info[19] = index === 1 ? "Old raid" : "New raid";
		info[22] = index === 1 ? 50 : 60;
		return info;
	});
	vi.stubGlobal("IsLFGDungeonJoinable", (id: number) => [
		id !== 104,
		id !== 104,
		id === 104,
	]);
	vi.stubGlobal("GetLFGQueuedList", () =>
		Object.fromEntries(
			Array.from({ length: queuedCount }, (_, i) => [101 + i, true]),
		),
	);
	vi.stubGlobal("GetLFGMode", (category: number, id?: number) =>
		category === 1 || (id !== undefined && id < 101 + queuedCount)
			? ["queued"]
			: [],
	);
	vi.stubGlobal("RaidFinderQueueFrame_SetRaid", vi.fn());
	vi.stubGlobal("RaidFinderFrameFindRaidButton", { IsEnabled: () => true });
	vi.stubGlobal("RaidFinderQueueFrame_Join", vi.fn());
	vi.stubGlobal("LeaveSingleLFG", vi.fn());
}

it("groups visible raid wings by raid, newest first, preserving wing order", () => {
	setupRaids();
	expect(new DungeonFinderClient().getRaids()).toMatchObject([
		{
			id: 60,
			name: "New raid",
			wings: [
				{ id: 102, name: "Wing 2", available: true, queued: false },
				{ id: 103, name: "Wing 3", available: true, queued: false },
			],
		},
		{
			id: 50,
			name: "Old raid",
			wings: [{ id: 101, name: "Wing 1", available: true, queued: false }],
		},
	]);
});

it("reads each raid wing's boss names and weekly killed status", () => {
	setupRaids();
	expect(
		new DungeonFinderClient().getRaids().at(0)?.wings.at(0)?.bosses,
	).toEqual([
		{ name: "Boss 102.1", killed: true },
		{ name: "Boss 102.2", killed: false },
	]);
});

it.each([undefined, "queued"])(
	"excludes legacy raid wings even when joinable or already queued (%s)",
	(mode) => {
		setupRaids();
		const dungeonInfo = GetRFDungeonInfo;
		vi.stubGlobal("GetRFDungeonInfo", (index: number) => {
			const info = [...dungeonInfo(index)];
			if (index === 1) info[9] = 6;
			return info;
		});
		vi.stubGlobal("GetLFGMode", (_category: number, id?: number) =>
			id === 101 ? [mode] : [],
		);
		const client = new DungeonFinderClient();
		expect(client.getRaids().map((raid) => raid.id)).toEqual([60]);
		client.joinRaid(101);
		expect(RaidFinderQueueFrame_Join).not.toHaveBeenCalled();
	},
);

it("joins multiple raid wings while a dungeon is queued, stopping at seven raid queues", () => {
	setupRaids(1);
	const client = new DungeonFinderClient();
	client.joinRaid(102);
	client.joinRaid(103);
	expect(RaidFinderQueueFrame_SetRaid).toHaveBeenCalledWith(102);
	expect(RaidFinderQueueFrame_Join).toHaveBeenCalledTimes(2);
	client.joinRaid(101);
	client.joinRaid(104);
	expect(RaidFinderQueueFrame_Join).toHaveBeenCalledTimes(2);
	setupRaids(7);
	expect(client.canQueueRaid()).toBe(false);
	client.joinRaid(103);
	expect(RaidFinderQueueFrame_Join).not.toHaveBeenCalled();
	client.leaveRaid(101);
	expect(LeaveSingleLFG).toHaveBeenCalledWith(3, 101);
	client.leaveRaid(999);
	expect(LeaveSingleLFG).toHaveBeenCalledOnce();
});

it("honors Blizzard's raid queue permission and proposal restrictions", () => {
	setupRaids();
	const client = new DungeonFinderClient();
	vi.stubGlobal("RaidFinderFrameFindRaidButton", { IsEnabled: () => false });
	client.joinRaid(102);
	expect(RaidFinderQueueFrame_Join).not.toHaveBeenCalled();
	vi.stubGlobal("GetLFGMode", () => ["proposal"]);
	client.leaveRaid(102);
	expect(LeaveSingleLFG).not.toHaveBeenCalled();
});

it("counts pending raid role checks toward capacity even before they appear in the queued list", () => {
	setupRaids(6);
	vi.stubGlobal("GetLFGMode", (category: number, id?: number) => {
		if (category === 1) return ["queued"];
		if (id === 104) return ["rolecheck"];
		return id !== undefined && id >= 201 && id <= 206 ? ["queued"] : [];
	});
	vi.stubGlobal("GetLFGQueuedList", () => ({
		201: true,
		202: true,
		203: true,
		204: true,
		205: true,
		206: true,
	}));
	const client = new DungeonFinderClient();
	expect(client.canQueueRaid()).toBe(false);
	client.joinRaid(102);
	expect(RaidFinderQueueFrame_Join).not.toHaveBeenCalled();
});

it("reads Blizzard's maintained choices after toggling instead of reloading saved choices", () => {
	setupChoices();
	const enabled = { 10: false };
	vi.stubGlobal("LFGEnabledList", enabled);
	vi.stubGlobal(
		"LFGDungeonList_SetDungeonEnabled",
		(id: number, checked: boolean) => {
			enabled[id as keyof typeof enabled] = checked;
		},
	);
	const client = new DungeonFinderClient();
	expect(client.getDungeonChoices("specific").at(0)?.checked).toBe(false);
	client.toggleDungeon("specific", 10);
	expect(client.getDungeonChoices("specific").at(0)?.checked).toBe(true);
	client.toggleDungeon("specific", 10);
	expect(client.getDungeonChoices("specific").at(0)?.checked).toBe(false);
});

it("reads and toggles request leader without changing combat roles", () => {
	setup();
	vi.stubGlobal("GetLFGRoles", () => [false, false, true, true]);
	const set = vi.fn();
	vi.stubGlobal("SetLFGRoles", set);
	vi.stubGlobal("LFG_UpdateAllRoleCheckboxes", vi.fn());
	vi.stubGlobal("LFDQueueFrame_UpdateRoleButtons", vi.fn());
	const client = new DungeonFinderClient();
	expect(client.getRoles()).toEqual({
		leader: false,
		tank: false,
		healer: true,
		damage: true,
	});
	client.toggleRole("leader");
	expect(set).toHaveBeenCalledWith(true, false, true, true);
	vi.stubGlobal("GetLFGMode", () => ["queued"]);
	client.toggleRole("leader");
	expect(set).toHaveBeenCalledOnce();
});

function setup() {
	vi.stubGlobal("GetLFGMode", () => []);
	vi.stubGlobal("GetNumRandomDungeons", () => 5);
	vi.stubGlobal("GetLFGRandomDungeonInfo", (index: number) => [
		index,
		`Dungeon ${index}`,
	]);
	vi.stubGlobal("GetLFGDungeonInfo", (id: number) => [
		`Dungeon ${id}`,
		6,
		id === 2 ? 2 : 1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		id === 2 ? 2 : 1,
		5,
		"",
		id === 3,
		false,
		false,
		id === 4,
	]);
	vi.stubGlobal("IsLFGDungeonJoinable", (id: number) => [
		id !== 5,
		id !== 5,
		id === 5,
	]);
	vi.stubGlobal("C_LFGInfo", { IsLFGFollowerDungeon: () => false });
}

function setupChoices() {
	setup();
	vi.stubGlobal("GetLFDChoiceOrder", () => [-1, 10, 11, 12, 13]);
	vi.stubGlobal("GetLFGDungeonInfo", (id: number) => [`Dungeon ${id}`]);
	vi.stubGlobal("GetLFDChoiceEnabledState", () => ({ 10: true, 11: true }));
	vi.stubGlobal("C_LFGInfo", {
		IsLFGFollowerDungeon: (id: number) => id === 11,
	});
	vi.stubGlobal("IsLFGDungeonJoinable", (id: number) => [
		id !== 12 && id !== 13,
		id !== 13,
		id === 13,
	]);
	vi.stubGlobal("LFD_CURRENT_FILTER", () => true);
	vi.stubGlobal("LFGLockList", {});
	vi.stubGlobal("LFDQueueFrame", { type: "specific" });
	vi.stubGlobal(
		"LFDQueueFrame_SetType",
		vi.fn((type: string | number) => {
			LFDQueueFrame.type = type;
		}),
	);
	vi.stubGlobal("LFDQueueFrame_Update", vi.fn());
	vi.stubGlobal("LFDQueueFrame_UpdateRoleButtons", vi.fn());
	vi.stubGlobal("LFGDungeonList_SetDungeonEnabled", vi.fn());
}

it("classifies specific choices using Blizzard dungeon difficulty", () => {
	setupChoices();
	vi.stubGlobal("GetLFGDungeonInfo", (id: number) => [
		`Dungeon ${id}`,
		1,
		id === 10 ? 2 : 1,
	]);
	const choices = new DungeonFinderClient().getDungeonChoices("specific");
	expect(choices.map((choice) => choice.difficulty)).toEqual([
		"heroic",
		"normal",
	]);
});

it("discovers specific and follower choices dynamically, excluding headers and hidden entries", () => {
	setupChoices();
	const client = new DungeonFinderClient();
	expect(client.getDungeonLists().map((list) => list.id)).toEqual([
		"follower",
		"specific",
	]);
	expect(client.getDungeonChoices("specific")).toEqual([
		{
			id: 10,
			name: "Dungeon 10",
			available: true,
			checked: true,
			difficulty: "normal",
		},
		{
			id: 12,
			name: "Dungeon 12",
			available: false,
			checked: false,
			difficulty: "normal",
		},
	]);
	expect(client.getDungeonChoices("follower")).toEqual([
		{
			id: 11,
			name: "Dungeon 11",
			available: true,
			checked: true,
			difficulty: "normal",
		},
	]);
});

it("picks up newly supplied dungeon IDs and honors Blizzard filters and hidden locks", () => {
	setupChoices();
	const client = new DungeonFinderClient();
	vi.stubGlobal("GetLFDChoiceOrder", () => [-1, 10, 20, 21, 22]);
	vi.stubGlobal("LFD_CURRENT_FILTER", (id: number) => id !== 21);
	vi.stubGlobal("LFGLockList", { 22: { hideEntry: true } });
	expect(
		client.getDungeonChoices("specific").map((choice) => choice.id),
	).toEqual([10, 20]);
});

it("switches queue lists and toggles only available members without joining", () => {
	setupChoices();
	const client = new DungeonFinderClient();
	client.selectList("follower");
	expect(LFDQueueFrame_SetType).toHaveBeenCalledWith("follower");
	expect(LFDQueueFrame_Update).toHaveBeenCalledOnce();
	client.toggleDungeon("follower", 11);
	expect(LFGDungeonList_SetDungeonEnabled).toHaveBeenCalledWith(11, false);
	client.toggleDungeon("follower", 10);
	client.toggleDungeon("specific", 12);
	expect(LFGDungeonList_SetDungeonEnabled).toHaveBeenCalledOnce();
	vi.stubGlobal("GetLFGMode", () => ["queued"]);
	client.toggleDungeon("follower", 11);
	client.selectList("specific");
	expect(LFGDungeonList_SetDungeonEnabled).toHaveBeenCalledOnce();
	expect(LFDQueueFrame.type).toBe("follower");
});

it("joins checked specific or follower choices through Blizzard and rejects empty selections", () => {
	setupChoices();
	vi.stubGlobal("LFDQueueFrameFindGroupButton", { IsEnabled: () => true });
	vi.stubGlobal("LFDQueueFrame_Join", vi.fn());
	const client = new DungeonFinderClient();
	client.join();
	client.selectList("follower");
	client.join();
	expect(LFDQueueFrame_Join).toHaveBeenCalledTimes(2);
	vi.stubGlobal("GetLFDChoiceEnabledState", () => ({}));
	client.join();
	expect(LFDQueueFrame_Join).toHaveBeenCalledTimes(2);
});

it("reads live names and groups events ahead of heroic and normal, hiding unavailable entries", () => {
	setup();
	expect(new DungeonFinderClient().getDungeons()).toEqual([
		{ id: 3, name: "Dungeon 3", section: "special", available: true },
		{ id: 4, name: "Dungeon 4", section: "special", available: true },
		{ id: 2, name: "Dungeon 2", section: "heroic", available: true },
		{ id: 1, name: "Dungeon 1", section: "normal", available: true },
	]);
});

it("excludes follower entries and shows visible locked queues without allowing selection", () => {
	setup();
	vi.stubGlobal("C_LFGInfo", {
		IsLFGFollowerDungeon: (id: number) => id === 1,
	});
	vi.stubGlobal("IsLFGDungeonJoinable", () => [false, true, false]);
	const select = vi.fn();
	vi.stubGlobal("LFDQueueFrame_SetType", select);
	const client = new DungeonFinderClient();
	expect(client.getDungeons().map((dungeon) => dungeon.id)).toEqual([
		3, 4, 2, 5,
	]);
	client.select(2);
	expect(select).not.toHaveBeenCalled();
});

it("selects an available queue and delegates joining to Blizzard's validated finder flow", () => {
	setup();
	const select = vi.fn();
	const join = vi.fn();
	vi.stubGlobal("LFDQueueFrame_SetType", select);
	vi.stubGlobal("LFDQueueFrame_Join", join);
	vi.stubGlobal("LFDQueueFrameFindGroupButton", { IsEnabled: () => true });
	vi.stubGlobal("LFDQueueFrame", { type: 2 });
	vi.stubGlobal("GetLFGMode", () => []);
	const client = new DungeonFinderClient();
	client.select(2);
	client.join();
	expect(select).toHaveBeenCalledWith(2);
	expect(join).toHaveBeenCalledOnce();
	vi.stubGlobal("LFDQueueFrameFindGroupButton", { IsEnabled: () => false });
	client.join();
	expect(join).toHaveBeenCalledOnce();
});

it("locks selection and role changes while queued and supports leaving", () => {
	setup();
	vi.stubGlobal("GetLFGMode", () => ["queued"]);
	const leave = vi.fn();
	vi.stubGlobal("LeaveLFG", leave);
	const client = new DungeonFinderClient();
	client.select(2);
	client.toggleRole("tank");
	expect(client.isQueued()).toBe(true);
	client.leave();
	expect(leave).toHaveBeenCalledWith(1);
});

it("toggles only roles supported by the player's class and synchronizes Blizzard controls", () => {
	setup();
	vi.stubGlobal("GetLFGRoles", () => [false, false, false, true]);
	vi.stubGlobal("C_LFGList", { GetAvailableRoles: () => [false, true, true] });
	const set = vi.fn();
	vi.stubGlobal("SetLFGRoles", set);
	vi.stubGlobal("LFG_UpdateAllRoleCheckboxes", vi.fn());
	vi.stubGlobal("LFDQueueFrame_UpdateRoleButtons", vi.fn());
	const client = new DungeonFinderClient();
	expect(client.getAvailableRoles()).toEqual({
		leader: true,
		tank: false,
		healer: true,
		damage: true,
	});
	client.toggleRole("tank");
	expect(set).not.toHaveBeenCalled();
	client.toggleRole("healer");
	expect(set).toHaveBeenCalledWith(false, false, true, true);
});
