import { afterEach, expect, it, vi } from "vitest";
import { DungeonFinderClient } from "./dungeon-finder-client";

afterEach(() => vi.unstubAllGlobals());

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

it("discovers specific and follower choices dynamically, excluding headers and hidden entries", () => {
	setupChoices();
	const client = new DungeonFinderClient();
	expect(client.getDungeonLists().map((list) => list.id)).toEqual([
		"follower",
		"specific",
	]);
	expect(client.getDungeonChoices("specific")).toEqual([
		{ id: 10, name: "Dungeon 10", available: true, checked: true },
		{ id: 12, name: "Dungeon 12", available: false, checked: false },
	]);
	expect(client.getDungeonChoices("follower")).toEqual([
		{ id: 11, name: "Dungeon 11", available: true, checked: true },
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
