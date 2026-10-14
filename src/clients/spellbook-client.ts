export interface BookSpell {
	readonly id: number;
	readonly name: string;
	readonly icon: number;
	readonly passive: boolean;
	readonly bookIndex: number;
}
export interface SpellGroup {
	readonly id: string;
	readonly name: string;
	readonly spells: readonly BookSpell[];
}
export interface ISpellbookClient {
	read(): readonly SpellGroup[];
	canModify(): boolean;
	bind(spell: number, key: string): string | undefined;
}
interface SkillLine {
	name: string;
	itemIndexOffset: number;
	numSpellBookItems: number;
	shouldHide: boolean;
}
interface NativeBookSpell {
	spellID?: number;
	itemType: number;
	name: string;
	iconID: number;
	isPassive: boolean;
	isOffSpec: boolean;
}
declare global {
	function PlaceAction(this: void, slot: number): void;
}
// Match the crossbar's secure slot driver; utility controls have no plain spell slot.
const slots: Readonly<Record<string, number | undefined>> = {
	PAD3: 1,
	PAD4: 2,
	PAD2: 3,
	PAD1: 4,
	PADDUP: 5,
	PADDRIGHT: 6,
	PADDDOWN: 7,
	PADDLEFT: 8,
};
// Enum.SpellBookSpellBank.Player and Enum.SpellBookItemType.Spell.
const playerBank = 0;
const spellItemType = 1;
export class SpellbookClient implements ISpellbookClient {
	read(): readonly SpellGroup[] {
		const groups: SpellGroup[] = [];
		for (
			let index = 1;
			index <= C_SpellBook.GetNumSpellBookSkillLines();
			index++
		) {
			const line = (
				C_SpellBook.GetSpellBookSkillLineInfo as unknown as (
					this: void,
					index: number,
				) => SkillLine | undefined
			)(index);
			if (!line || line.shouldHide) continue;
			const spells: BookSpell[] = [];
			for (let offset = 1; offset <= line.numSpellBookItems; offset++) {
				const bookIndex = line.itemIndexOffset + offset;
				const info = (
					C_SpellBook.GetSpellBookItemInfo as unknown as (
						this: void,
						index: number,
						bank: number,
					) => NativeBookSpell | undefined
				)(bookIndex, playerBank);
				if (
					!info ||
					info.itemType !== spellItemType ||
					!info.spellID ||
					info.isOffSpec
				)
					continue;
				spells.push({
					id: info.spellID,
					name: info.name,
					icon: info.iconID,
					passive: info.isPassive,
					bookIndex,
				});
			}
			groups.push({ id: `skill-${index}`, name: line.name, spells });
		}
		return groups;
	}
	canModify(): boolean {
		return !InCombatLockdown();
	}
	private slot(key: string): number | undefined {
		if (key === "PADRTRIGGER") return 156;
		if (key === "PADLSHOULDER") return 155;
		const parts = key.split("-");
		const button = parts.at(-1) ?? "";
		const base = slots[button];
		if (!base) return undefined;
		const prefix = parts.slice(0, -1).join("-");
		if (prefix === "CTRL-SHIFT") return 172 + base;
		if (prefix === "SHIFT") return 164 + base;
		if (prefix === "CTRL") return 156 + base;
		if (prefix !== "" || base > 3) return undefined;
		if (C_ActionBar.HasVehicleActionBar()) return undefined;
		if (
			C_ActionBar.HasOverrideActionBar() ||
			C_ActionBar.HasTempShapeshiftActionBar()
		)
			return undefined;
		const bonus = C_ActionBar.GetBonusBarOffset();
		const page = bonus > 0 ? bonus + 6 : C_ActionBar.GetActionBarPage();
		return (page - 1) * 12 + base;
	}
	bind(spell: number, key: string): string | undefined {
		if (!this.canModify()) return "Cannot bind spells in combat.";
		const slot = this.slot(key);
		if (slot === undefined)
			return "That control is reserved or unsupported. Try another controller bind.";
		const entry = this.read()
			.flatMap((group) => group.spells)
			.find((entry) => entry.id === spell);
		if (!entry || entry.passive) return "This spell cannot be bound.";
		const [cursor] = (
			GetCursorInfo as unknown as (
				this: void,
			) => LuaMultiReturn<[string | undefined]>
		)();
		if (cursor) return "Clear the cursor before binding a spell.";
		C_SpellBook.PickupSpellBookItem(entry.bookIndex, playerBank);
		if (!CursorHasSpell()) return "Could not pick up this spell.";
		PlaceAction(slot);
		ClearCursor();
		return undefined;
	}
}
