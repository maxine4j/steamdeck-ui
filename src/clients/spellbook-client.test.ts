import { afterEach, expect, it, vi } from "vitest";
import { SpellbookClient } from "./spellbook-client";

afterEach(() => vi.unstubAllGlobals());
function setup() {
	vi.stubGlobal("Enum", {
		SpellBookSpellBank: { Player: 0 },
		SpellBookItemType: { Spell: 1, Flyout: 4 },
	});
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("C_SpellBook", {
		GetNumSpellBookSkillLines: () => 2,
		GetSpellBookSkillLineInfo: (index: number) => ({
			name: index === 1 ? "Class" : "Hidden",
			itemIndexOffset: 0,
			numSpellBookItems: 4,
			shouldHide: index === 2,
		}),
		GetSpellBookItemInfo: (index: number) => ({
			name: `Spell ${index}`,
			iconID: index,
			spellID: 100 + index,
			actionID: 100 + index,
			itemType: index === 4 ? 4 : 1,
			isPassive: index === 2,
			isOffSpec: index === 3,
		}),
		PickupSpellBookItem: vi.fn(),
	});
	vi.stubGlobal("GetActionBarPage", () => 2);
	vi.stubGlobal("GetBonusBarOffset", () => 0);
	vi.stubGlobal("HasVehicleActionBar", () => false);
	vi.stubGlobal("HasOverrideActionBar", () => false);
	vi.stubGlobal("HasTempShapeshiftActionBar", () => false);
	vi.stubGlobal("C_ActionBar", {
		GetActionBarPage: () => 2,
		GetBonusBarOffset: () => 0,
		HasVehicleActionBar: () => false,
		HasOverrideActionBar: () => false,
		HasTempShapeshiftActionBar: () => false,
	});
	vi.stubGlobal("GetCursorInfo", () => []);
	vi.stubGlobal("CursorHasSpell", () => true);
	vi.stubGlobal("PlaceAction", vi.fn());
	vi.stubGlobal("ClearCursor", vi.fn());
	return new SpellbookClient();
}
it("reads visible learned spells grouped by skill line, retaining passives and excluding off-spec items", () => {
	const client = setup();
	expect(client.read()).toEqual([
		{
			id: "skill-1",
			name: "Class",
			spells: [
				{ id: 101, name: "Spell 1", icon: 1, passive: false, bookIndex: 1 },
				{ id: 102, name: "Spell 2", icon: 2, passive: true, bookIndex: 2 },
			],
		},
	]);
});
it.each([
	["PAD3", 13],
	["PAD4", 14],
	["PAD2", 15],
	["SHIFT-PAD1", 168],
	["CTRL-PADDUP", 161],
	["CTRL-SHIFT-PADDLEFT", 180],
	["PADRTRIGGER", 156],
	["PADLSHOULDER", 155],
])("places a spell on the crossbar slot for %s", (key, slot) => {
	const client = setup();
	expect(client.bind(101, key)).toBeUndefined();
	expect(C_SpellBook.PickupSpellBookItem).toHaveBeenCalledWith(1, 0);
	expect(PlaceAction).toHaveBeenCalledWith(slot);
	expect(ClearCursor).toHaveBeenCalledOnce();
});
it.each([
	"PADLTRIGGER",
	"PADDUP",
	"PADDLEFT",
	"PADDRIGHT",
	"PADDDOWN",
	"PAD1",
	"PADRSHOULDER",
	"SHIFT-PADRSHOULDER",
	"ALT-PAD3",
	"SHIFT-PADLTRIGGER",
])(
	"rejects reserved or unsupported bind %s without touching the cursor",
	(key) => {
		const client = setup();
		expect(client.bind(101, key)).toBeTruthy();
		expect(C_SpellBook.PickupSpellBookItem).not.toHaveBeenCalled();
	},
);
it("rejects combat, passives, missing spells and occupied cursors", () => {
	const client = setup();
	expect(client.bind(102, "PAD3")).toBeTruthy();
	expect(client.bind(999, "PAD3")).toBeTruthy();
	vi.stubGlobal("InCombatLockdown", () => true);
	expect(client.bind(101, "PAD3")).toBeTruthy();
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("GetCursorInfo", () => ["item"]);
	expect(client.bind(101, "PAD3")).toBeTruthy();
	expect(C_SpellBook.PickupSpellBookItem).not.toHaveBeenCalled();
});
