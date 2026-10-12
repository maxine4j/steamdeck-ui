import { afterEach, expect, it, vi } from "vitest";
import { CharacterClient } from "./character-client";

afterEach(() => vi.unstubAllGlobals());
it("reads character identity and handles characters without a guild or specialization", () => {
	vi.stubGlobal(
		"UnitName",
		vi.fn(() => ["Mings", "Realm"]),
	);
	vi.stubGlobal(
		"UnitLevel",
		vi.fn(() => 80),
	);
	vi.stubGlobal(
		"UnitRace",
		vi.fn(() => ["Night Elf", "NightElf", 4]),
	);
	vi.stubGlobal(
		"UnitClass",
		vi.fn(() => ["Druid", "DRUID", 11]),
	);
	const guild = vi.fn((): [string | undefined] => ["Deck Crew"]);
	vi.stubGlobal("GetGuildInfo", guild);
	const specialization = {
		GetSpecialization: vi.fn((): number | undefined => 2),
		GetSpecializationInfo: vi.fn(() => [103, "Feral"]),
	};
	vi.stubGlobal("C_SpecializationInfo", specialization);
	const client = new CharacterClient();
	expect(client.getIdentity()).toEqual({
		name: "Mings",
		guild: "Deck Crew",
		level: 80,
		race: "Night Elf",
		className: "Druid",
		specialization: "Feral",
	});
	expect(guild).toHaveBeenCalledWith("player");
	expect(specialization.GetSpecializationInfo).toHaveBeenCalledWith(
		2,
		false,
		false,
	);
	guild.mockReturnValue([undefined]);
	specialization.GetSpecialization.mockReturnValue(undefined);
	expect(client.getIdentity()).toMatchObject({
		guild: undefined,
		specialization: undefined,
	});
	expect(specialization.GetSpecializationInfo).toHaveBeenCalledOnce();
});
function setup() {
	let next = 0;
	const slots = new Map<string, number>();
	vi.stubGlobal("C_PaperDollInfo", {
		GetInventorySlotInfo: (name: string) => {
			if (!slots.has(name)) slots.set(name, ++next);
			return [slots.get(name), 100];
		},
	});
	vi.stubGlobal(
		"GetInventoryItemID",
		vi.fn((_unit: string, slot: number) => (slot === 1 ? 42 : undefined)),
	);
	vi.stubGlobal(
		"GetInventoryItemLink",
		vi.fn((_unit: string, slot: number) =>
			slot === 1 ? "item:42:bonus" : undefined,
		),
	);
	vi.stubGlobal(
		"GetInventoryItemTexture",
		vi.fn((_unit: string, slot: number) => (slot === 1 ? 123 : undefined)),
	);
	vi.stubGlobal(
		"GetInventoryItemQuality",
		vi.fn(() => 4),
	);
	const item = {
		GetItemUpgradeInfo: vi.fn<
			() =>
				| { trackString?: string; currentLevel: number; maxLevel: number }
				| undefined
		>(() => ({ trackString: "Hero", currentLevel: 5, maxLevel: 6 })),
		IsItemDataCachedByID: vi.fn(() => false),
		RequestLoadItemDataByID: vi.fn(),
		GetDetailedItemLevelInfo: vi.fn(() => [150]),
	};
	vi.stubGlobal("C_Item", item);
	const pickup = vi.fn();
	const use = vi.fn();
	const lock = vi.fn(() => false);
	vi.stubGlobal("PickupInventoryItem", pickup);
	vi.stubGlobal("UseInventoryItem", use);
	vi.stubGlobal("IsInventoryItemLocked", lock);
	return { client: new CharacterClient(), item, pickup, use, lock };
}
it("includes empty slots, requests unloaded equipment once and reads the equipped bonus level", () => {
	const { client, item } = setup();
	const equipment = client.getEquipment();
	expect(equipment).toHaveLength(18);
	expect(equipment.at(0)).toMatchObject({
		slotId: 1,
		name: "Head",
		icon: 123,
		itemId: 42,
		quality: 4,
		itemLevel: 150,
		upgradeTrack: { name: "Hero", rank: 5, maxRank: 6 },
	});
	expect(equipment.at(1)).toMatchObject({
		name: "Neck",
		icon: 100,
		itemId: undefined,
	});
	expect(item.GetDetailedItemLevelInfo).toHaveBeenCalledWith("item:42:bonus");
	expect(item.GetItemUpgradeInfo).toHaveBeenCalledWith("item:42:bonus");
	client.getEquipment();
	expect(item.RequestLoadItemDataByID).toHaveBeenCalledExactlyOnceWith(42);
});
it("omits upgrade data for untracked, unloaded and empty slots", () => {
	const { client, item } = setup();
	item.GetItemUpgradeInfo.mockReturnValue(undefined);
	expect(client.getEquipment().at(0)).toMatchObject({
		name: "Head",
		upgradeTrack: undefined,
	});
	expect(client.getEquipment().at(1)?.upgradeTrack).toBeUndefined();
});
it("uses physical slots, rejects stale and locked equipment and allows cursor equipment into empty slots", () => {
	const { client, pickup, use, lock } = setup();
	const gear = client.getEquipment().at(0);
	const empty = client.getEquipment().at(1);
	if (!gear || !empty) throw new Error("Missing equipment slots");
	client.pickup(gear);
	client.use(gear);
	client.pickup(empty);
	client.use(empty);
	expect(pickup.mock.calls).toEqual([[1], [2]]);
	expect(use.mock.calls).toEqual([[1]]);
	lock.mockReturnValue(true);
	client.pickup(gear);
	client.use(gear);
	lock.mockReturnValue(false);
	client.pickup({ ...gear, itemId: 999 });
	client.use({ ...gear, hyperlink: "item:42:different" });
	client.pickup({ ...gear, slotId: 99 });
	expect(pickup).toHaveBeenCalledTimes(2);
	expect(use).toHaveBeenCalledOnce();
});
it("uses native open/toggle/close semantics and excludes reputation and currency", () => {
	const client = new CharacterClient();
	const native = {
		IsShown: vi.fn(() => true),
		activeSubframe: "PaperDollFrame",
	};
	const toggle = vi.fn();
	const hide = vi.fn();
	vi.stubGlobal("CharacterFrame", native);
	vi.stubGlobal("ToggleCharacter", toggle);
	vi.stubGlobal("HideUIPanel", hide);
	expect(client.isOpen()).toBe(true);
	client.open();
	client.toggle();
	client.close();
	expect(toggle.mock.calls).toEqual([
		["PaperDollFrame", true],
		["PaperDollFrame"],
	]);
	expect(hide).toHaveBeenCalledExactlyOnceWith(native);
	native.activeSubframe = "ReputationFrame";
	expect(client.isOpen()).toBe(false);
	client.close();
	expect(hide).toHaveBeenCalledOnce();
	native.activeSubframe = "PaperDollFrame";
	native.IsShown.mockReturnValue(false);
	expect(client.isOpen()).toBe(false);
});
it("converts Retail primary stats, minimum spell school crit and total versatility", () => {
	const client = new CharacterClient();
	vi.stubGlobal(
		"UnitStat",
		vi.fn((_unit: string, index: number) => [10, index * 100, 0, 0]),
	);
	vi.stubGlobal(
		"UnitArmor",
		vi.fn(() => [10, 250, 0, 0]),
	);
	vi.stubGlobal(
		"UnitHealthMax",
		vi.fn(() => 10000),
	);
	vi.stubGlobal(
		"GetAverageItemLevel",
		vi.fn(() => [160, 150, 170]),
	);
	vi.stubGlobal(
		"GetMasteryEffect",
		vi.fn(() => [25, 1]),
	);
	vi.stubGlobal(
		"GetSpellCritChance",
		vi.fn((school: number) => (school === 4 ? 12 : 50)),
	);
	for (const [name, value] of [
		["GetCritChance", 15],
		["GetRangedCritChance", 16],
		["GetHaste", 20],
		["GetCombatRatingBonus", 5],
		["GetVersatilityBonus", 2],
		["GetLifesteal", 3],
		["GetAvoidance", 4],
		["GetSpeed", 5],
	] as const)
		vi.stubGlobal(name, () => value);
	expect(client.getStats()).toEqual(
		expect.arrayContaining([
			{ label: "Item level", value: "150" },
			{ label: "Stamina", value: "300" },
			{ label: "Critical strike", value: "16%" },
			{ label: "Versatility", value: "7%" },
		]),
	);
});
