export interface EquipmentUpgradeTrack {
	readonly name: string;
	readonly rank: number;
	readonly maxRank: number;
}
export interface EquipmentSlot {
	readonly slotId: number;
	readonly name: string;
	readonly icon: number;
	readonly itemId?: number;
	readonly quality: number;
	readonly itemLevel?: number;
	readonly upgradeTrack?: EquipmentUpgradeTrack;
	readonly hyperlink?: string;
}
export interface CharacterStat {
	readonly label: string;
	readonly value: string;
}
export interface CharacterIdentity {
	readonly name: string;
	readonly guild?: string;
	readonly level: number;
	readonly race: string;
	readonly className: string;
	readonly specialization?: string;
}
export interface ICharacterActions {
	close(): void;
	pickup(slot: EquipmentSlot): void;
	use(slot: EquipmentSlot): void;
}
export interface ICharacterClient extends ICharacterActions {
	open(): void;
	toggle(): void;
	isOpen(): boolean;
	getEquipment(): EquipmentSlot[];
	getStats(): CharacterStat[];
	getIdentity(): CharacterIdentity;
}
const slotNames = [
	["HeadSlot", "Head"],
	["NeckSlot", "Neck"],
	["ShoulderSlot", "Shoulders"],
	["BackSlot", "Back"],
	["ChestSlot", "Chest"],
	["ShirtSlot", "Shirt"],
	["TabardSlot", "Tabard"],
	["WristSlot", "Wrists"],
	["HandsSlot", "Hands"],
	["WaistSlot", "Waist"],
	["LegsSlot", "Legs"],
	["FeetSlot", "Feet"],
	["Finger0Slot", "Ring 1"],
	["Finger1Slot", "Ring 2"],
	["Trinket0Slot", "Trinket 1"],
	["Trinket1Slot", "Trinket 2"],
	["MainHandSlot", "Main hand"],
	["SecondaryHandSlot", "Off hand"],
] as const;
export class CharacterClient implements ICharacterClient {
	private readonly requested = new Set<number>();
	getIdentity(): CharacterIdentity {
		// Generated unit-token types are numeric, but Retail accepts "player".
		const unitName = UnitName as unknown as (
			this: void,
			unit: string,
		) => LuaMultiReturn<[string, string]>;
		const unitRace = UnitRace as unknown as (
			this: void,
			unit: string,
		) => LuaMultiReturn<[string, string, number]>;
		const unitClass = UnitClass as unknown as (
			this: void,
			unit: string,
		) => LuaMultiReturn<[string, string, number]>;
		const [name] = unitName("player");
		const [race] = unitRace("player");
		const [className] = unitClass("player");
		const [guild] = GetGuildInfo("player");
		const spec = C_SpecializationInfo.GetSpecialization();
		let specialization: string | undefined;
		if (spec && spec > 0) {
			const [, specName] = C_SpecializationInfo.GetSpecializationInfo(
				spec,
				false,
				false,
			);
			specialization = specName ?? undefined;
		}
		return {
			name,
			guild: guild || undefined,
			level: UnitLevel("player"),
			race,
			className,
			specialization,
		};
	}
	isOpen(): boolean {
		return (
			CharacterFrame.IsShown() &&
			CharacterFrame.activeSubframe === "PaperDollFrame"
		);
	}
	open(): void {
		ToggleCharacter("PaperDollFrame", true);
	}
	toggle(): void {
		ToggleCharacter("PaperDollFrame");
	}
	close(): void {
		if (this.isOpen()) HideUIPanel(CharacterFrame);
	}
	private current(slot: EquipmentSlot): boolean {
		return (
			slotNames.some(([name]) => {
				const [id] = C_PaperDollInfo.GetInventorySlotInfo(name);
				return id === slot.slotId;
			}) &&
			!IsInventoryItemLocked(slot.slotId) &&
			(GetInventoryItemID("player", slot.slotId) ?? undefined) ===
				slot.itemId &&
			(GetInventoryItemLink("player", slot.slotId) ?? undefined) ===
				slot.hyperlink
		);
	}
	pickup(slot: EquipmentSlot): void {
		if (this.current(slot)) PickupInventoryItem(slot.slotId);
	}
	use(slot: EquipmentSlot): void {
		if (slot.itemId !== undefined && this.current(slot))
			UseInventoryItem(slot.slotId);
	}
	getEquipment(): EquipmentSlot[] {
		return slotNames.map(([nativeName, name]) => {
			const [slotId, emptyIcon] =
				C_PaperDollInfo.GetInventorySlotInfo(nativeName);
			const itemId = GetInventoryItemID("player", slotId) ?? undefined;
			const hyperlink = GetInventoryItemLink("player", slotId) ?? undefined;
			let itemLevel: number | undefined;
			let upgradeTrack: EquipmentUpgradeTrack | undefined;
			if (itemId !== undefined) {
				if (
					!C_Item.IsItemDataCachedByID(itemId) &&
					!this.requested.has(itemId)
				) {
					this.requested.add(itemId);
					C_Item.RequestLoadItemDataByID(itemId);
				}
				const levelInfo = C_Item.GetDetailedItemLevelInfo as unknown as (
					this: void,
					info: string | number,
				) => LuaMultiReturn<[number, boolean, number]>;
				[itemLevel] = levelInfo(hyperlink ?? itemId);
				// The generated declaration reduces this structured return to a number.
				const upgradeInfo = C_Item.GetItemUpgradeInfo as unknown as (
					this: void,
					info: string | number,
				) =>
					| { trackString?: string; currentLevel: number; maxLevel: number }
					| undefined;
				const upgrade = upgradeInfo(hyperlink ?? itemId);
				if (upgrade?.trackString && upgrade.maxLevel > 0) {
					upgradeTrack = {
						name: upgrade.trackString,
						rank: upgrade.currentLevel,
						maxRank: upgrade.maxLevel,
					};
				}
			}
			return {
				slotId,
				name,
				itemId,
				hyperlink,
				itemLevel,
				upgradeTrack,
				icon: GetInventoryItemTexture("player", slotId) ?? emptyIcon,
				quality: GetInventoryItemQuality("player", slotId) ?? 1,
			};
		});
	}
	getStats(): CharacterStat[] {
		// Generated unit-token types are numeric, but Retail accepts "player".
		const stat = UnitStat as unknown as (
			this: void,
			unit: string,
			index: number,
		) => LuaMultiReturn<[number, number, number, number]>;
		const armor = UnitArmor as unknown as (
			this: void,
			unit: string,
		) => LuaMultiReturn<[number, number, number, number]>;
		const health = UnitHealthMax as unknown as (
			this: void,
			unit: string,
		) => number;
		const [, equipped] = GetAverageItemLevel();
		const [, effectiveArmor] = armor("player");
		const [mastery] = GetMasteryEffect();
		let spellCrit = 100;
		const spellChance = GetSpellCritChance as unknown as (
			this: void,
			school: number,
		) => number;
		for (let school = 2; school <= 7; school++)
			spellCrit = Math.min(spellCrit, spellChance(school));
		const percent = (value: number) =>
			`${Math.floor(value * 100 + 0.5) / 100}%`;
		const stats: CharacterStat[] = [
			{ label: "Item level", value: `${Math.floor(equipped)}` },
			{ label: "Health", value: `${health("player")}` },
		];
		for (const [label, index] of [
			["Strength", 1],
			["Agility", 2],
			["Stamina", 3],
			["Intellect", 4],
		] as const) {
			const [, effective] = stat("player", index);
			stats.push({ label, value: `${effective}` });
		}
		stats.push(
			{ label: "Armor", value: `${effectiveArmor}` },
			{
				label: "Critical strike",
				value: percent(
					Math.max(spellCrit, GetCritChance(), GetRangedCritChance()),
				),
			},
			{ label: "Haste", value: percent(GetHaste()) },
			{ label: "Mastery", value: percent(mastery) },
			{
				label: "Versatility",
				value: percent(
					(GetCombatRatingBonus(29) ?? 0) + GetVersatilityBonus(29),
				),
			},
			{ label: "Leech", value: percent(GetLifesteal()) },
			{ label: "Avoidance", value: percent(GetAvoidance()) },
			{ label: "Speed", value: percent(GetSpeed()) },
		);
		return stats;
	}
}
