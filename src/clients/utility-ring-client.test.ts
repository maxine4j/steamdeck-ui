import { afterEach, expect, it, vi } from "vitest";
import { ActionBarClient } from "./action-bar-client";

afterEach(() => vi.unstubAllGlobals());

function setup(className = "HUNTER") {
	vi.stubGlobal("C_GamePad", { StickIndexToConfigName: () => undefined });
	vi.stubGlobal("UnitClass", () => ["Class", className]);
	vi.stubGlobal("GetPetActionInfo", (slot: number) =>
		slot === 1
			? ["Attack", "PET_ATTACK_TEXTURE", true]
			: slot === 4
				? ["Bite", 123, false, false, true, true, 456]
				: [],
	);
	vi.stubGlobal("_G", { PET_ATTACK_TEXTURE: "attack-icon" });
	vi.stubGlobal("GetNumShapeshiftForms", () => 0);
	vi.stubGlobal("GetShapeshiftFormInfo", () => []);
	vi.stubGlobal("C_Spell", {
		GetSpellTexture: (spell: number) => spell,
		GetSpellCooldownDuration: () => undefined,
		GetSpellChargeDuration: () => undefined,
	});
	vi.stubGlobal("C_QuestLog", { GetNumQuestLogEntries: () => [3, 2] });
	vi.stubGlobal("GetQuestLogSpecialItemInfo", (index: number) =>
		index > 1 ? ["|Hitem:100:0|h[Quest item]|h", 101] : [],
	);
	vi.stubGlobal("C_Container", {
		GetContainerNumSlots: (bag: number) => (bag === 0 ? 3 : 0),
		GetContainerItemID: (_bag: number, slot: number) => 99 + slot,
		GetContainerItemQuestInfo: () => ({ isQuestItem: true }),
	});
	vi.stubGlobal("C_Item", {
		GetItemIDForItemInfo: () => 100,
		IsUsableItem: (item: number) => [item !== 102],
		GetItemIconByID: (item: number) => item + 1,
	});
	vi.stubGlobal("C_ZoneAbility", {
		GetActiveAbilities: () => [
			{ spellID: 300, uiPriority: 2 },
			{ spellID: 200, uiPriority: 1 },
			{ spellID: 300, uiPriority: 3 },
		],
		GetZoneAbilityIcon: (spell: number) => spell + 1,
	});
	vi.stubGlobal("ExtraActionButton1", { action: 217 });
	return new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
}

it.each(["HUNTER", "WARLOCK"])(
	"uses populated pet actions for %s, including command-token icons",
	(className) => {
		const client = setup(className);
		const driver = client.getRingDriver("class");
		expect(driver.actions).toEqual([
			{ slot: 1, type: "pet", value: 1 },
			{ slot: 2, type: "pet", value: 4 },
		]);
		expect(driver.occupied).toContain("[pet,novehicleui,nopossessbar]");
		expect(client.readRing("class", 1).icon).toBe("attack-icon");
		expect(client.readRing("class", 2).icon).toBe(123);
	},
);

it.each(["DRUID", "WARRIOR", "SHAMAN"])(
	"uses only the available %s forms, and re-reads them after spec changes",
	(className) => {
		const client = setup(className);
		let count = 2;
		vi.stubGlobal("GetNumShapeshiftForms", () => count);
		vi.stubGlobal("GetShapeshiftFormInfo", (index: number) => [
			index,
			false,
			true,
			100 + index,
		]);
		expect(client.getRingDriver("class").actions).toEqual([
			{ slot: 1, type: "spell", value: 101 },
			{ slot: 2, type: "spell", value: 102 },
		]);
		count = 0;
		expect(client.getRingDriver("class").slots).toEqual([]);
	},
);

it("leaves unsupported classes empty instead of borrowing a pet or vehicle bar", () => {
	const client = setup("MAGE");
	expect(client.getRingDriver("class").slots).toEqual([]);
});

it("collects all quest-use items and zone abilities, deduplicates them and uses Retail's extra-action slot", () => {
	const client = setup();
	const driver = client.getRingDriver("utility");
	expect(driver.actions).toEqual([
		{ slot: 217, type: "action", value: 217 },
		{ slot: 1, type: "item", value: "item:100" },
		{ slot: 2, type: "item", value: "item:101" },
		{ slot: 3, type: "spell", value: 200 },
		{ slot: 4, type: "spell", value: 300 },
	]);
	expect(driver.occupied).toContain("[extrabar]");
	expect(client.readRing("utility", 1).icon).toBe(101);
	expect(client.readRing("utility", 4).icon).toBe(301);
});

it("keeps the utility ring's extra-action candidate when no quests or zone abilities exist", () => {
	const client = setup();
	vi.stubGlobal("C_QuestLog", { GetNumQuestLogEntries: () => [0, 0] });
	vi.stubGlobal("C_Container", { GetContainerNumSlots: () => 0 });
	vi.stubGlobal("C_ZoneAbility", { GetActiveAbilities: () => [] });
	expect(client.getRingDriver("utility").slots).toEqual([217]);
});
