import type { WowFrame } from "../types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";
import type {
	RadialAction,
	RadialDriver,
} from "../ui/components/secure-radial-menu";
import type {
	BindingTarget,
	CooldownDuration,
	SlotDriver,
	SlotVisual,
} from "../ui/components/secure-slot-button";

type NativeBar = WowFrame & { GetParent(): WowFrame | undefined };
declare global {
	function GetActionInfo(
		this: void,
		slot: number,
	): LuaMultiReturn<[string | undefined, number]>;
	const ExtraActionButton1: { action: number };
	const ExtraActionBarFrame: NativeBar | undefined;
	const PetActionBarFrame: NativeBar | undefined;
	const ZoneAbilityFrame: NativeBar | undefined;
	function GetPetActionInfo(
		this: void,
		slot: number,
	): LuaMultiReturn<
		[
			string | undefined,
			string | number | undefined,
			boolean | undefined,
			boolean | undefined,
			boolean | undefined,
			boolean | undefined,
			number | undefined,
		]
	>;
	function GetNumShapeshiftForms(this: void): number;
	function GetShapeshiftFormInfo(
		this: void,
		index: number,
	): LuaMultiReturn<[number | undefined, boolean, boolean, number | undefined]>;
	function GetQuestLogSpecialItemInfo(
		this: void,
		index: number,
	): LuaMultiReturn<[string | undefined, number | undefined]>;
	const MainActionBar: NativeBar;
	const MultiBarBottomLeft: NativeBar;
	const MultiBarBottomRight: NativeBar;
	const MultiBarLeft: NativeBar;
	const MultiBarRight: NativeBar;
	const MultiBar5: NativeBar;
	const MultiBar6: NativeBar;
	const MultiBar7: NativeBar;
	function SetOverrideBindingClick(
		this: void,
		owner: WowFrame,
		priority: boolean,
		key: string,
		name: string,
		button: string,
	): void;
	function ClearOverrideBindings(this: void, owner: WowFrame): void;
	function SetOverrideBinding(
		this: void,
		owner: WowFrame,
		priority: boolean,
		key: string,
		command: string,
	): void;
}
export type ActionRingKind = "abilities" | "class" | "utility";
interface RingEntry extends RadialAction {
	readonly icon?: number | string;
}
export interface ActionBinding {
	key: string;
	target: BindingTarget;
	defaultCommand?: "JUMP";
	prefixes?: readonly ("" | "SHIFT-" | "CTRL-" | "CTRL-SHIFT-")[];
}
export interface IActionBarClient {
	canModify(): boolean;
	disableBuiltIn(): void;
	syncBuiltInVisibility(): void;
	getSlotDriver(
		slot: number,
		defaultCommand?: "JUMP" | "RING" | "EXTRA" | "MOUNT" | "FIXED",
	): SlotDriver;
	getRingDriver(kind?: ActionRingKind): RadialDriver;
	readRing(kind: ActionRingKind, slot: number): SlotVisual;
	read(slot: number): SlotVisual;
	bind(bindings: readonly ActionBinding[]): void;
	restore(): void;
}
export class ActionBarClient implements IActionBarClient {
	private suppressed = false;
	private readonly owners: WowFrame[] = [];
	private readonly ringEntries = new Map<
		ActionRingKind,
		readonly RingEntry[]
	>();
	constructor(private readonly frames: IFrameSuppression) {}
	canModify(): boolean {
		return !InCombatLockdown();
	}
	disableBuiltIn(): void {
		if (this.suppressed) return;
		this.frames.suppress([
			PetActionBarFrame,
			ZoneAbilityFrame,
			ExtraActionBarFrame,
			MainActionBar,
			MultiBarBottomLeft,
			MultiBarBottomRight,
			MultiBarLeft,
			MultiBarRight,
			MultiBar5,
			MultiBar6,
			MultiBar7,
		].filter((frame): frame is NativeBar => frame !== undefined));
		this.suppressed = true;
	}
	getSlotDriver(
		slot: number,
		defaultCommand?: "JUMP" | "RING" | "EXTRA" | "MOUNT" | "FIXED",
	): SlotDriver {
		if (defaultCommand === "FIXED")
			return {
				condition: `${slot}`,
				response: 'self:SetAttribute("action", tonumber(newstate))',
			};
		// Retail Edit Mode bars 6/7/8 use action pages 13/14/15 (ConsolePort Actionbar.lua).
		// Distinct states trigger the secure handler when the main bar changes.
		const mainConditions = [
			"[vehicleui] vehicle",
			"[possessbar] possess",
			"[overridebar] override",
			"[shapeshift] shapeshift",
			...[2, 3, 4, 5, 6].map((page) => `[bar:${page}] page${page}`),
			...[1, 2, 3, 4, 5].map((bonus) => `[bonusbar:${bonus}] bonus${bonus}`),
			"main",
		].join("; ");
		return {
			condition: `[mod:shift,mod:ctrl] ${172 + slot}; [mod:shift] ${164 + slot}; [mod:ctrl] ${156 + slot}; ${defaultCommand === "JUMP" ? "0" : defaultCommand === "RING" ? "-1" : defaultCommand === "MOUNT" ? "-3" : defaultCommand === "EXTRA" ? "[extrabar] 217; -2" : mainConditions}`,
			// Restricted WoW handlers expose these APIs without the C_ActionBar namespace.
			// Resolve pages at transition time, including transitions during combat.
			response: `
local action = tonumber(newstate)
if not action then
	local page
	if HasVehicleActionBar() then
		page = GetVehicleBarIndex()
	elseif HasOverrideActionBar() then
		page = GetOverrideBarIndex()
	elseif HasTempShapeshiftActionBar() then
		page = GetTempShapeshiftBarIndex()
	elseif GetBonusBarOffset() > 0 then
		page = GetBonusBarOffset() + 6
	else
		page = GetActionBarPage()
	end
	action = (page - 1) * 12 + ${slot}
end
${defaultCommand === "EXTRA" ? 'self:SetAttribute("type", action == -2 and "spell" or "action")\n' : defaultCommand === "MOUNT" ? 'self:SetAttribute("macrotext", action == -3 and "/run C_MountJournal.SummonByID(0)" or nil)\nself:SetAttribute("type", action == -3 and "macro" or "action")\n' : ""}self:SetAttribute("action", action)`,
		};
	}
	getRingDriver(kind: ActionRingKind = "abilities"): RadialDriver {
		// Edit Mode bar 6 is page 13; reserve slots 155/156 for LB/RT.
		let rightStick = 2;
		for (let index = 0; index < 8; index++) {
			const name = C_GamePad.StickIndexToConfigName(index);
			if (!name) break;
			if (name === "Right") {
				rightStick = index + 1;
				break;
			}
		}
		const entries =
			kind === "class"
				? this.classEntries()
				: kind === "utility"
					? this.utilityEntries()
					: undefined;
		if (entries) this.ringEntries.set(kind, entries);
		return {
			slots:
				entries?.map((entry) => entry.slot) ??
				Array.from({ length: 10 }, (_, i) => 145 + i),
			...(entries
				? {
						actions: entries.map(({ slot, type, value }) => ({
							slot,
							type,
							value,
						})),
					}
				: {}),
			occupied:
				kind === "abilities"
					? "return HasAction(slot)"
					: kind === "class"
						? `if self:GetAttribute("kind"..slot) == "pet" then
	return SecureCmdOptionParse("[pet,novehicleui,nopossessbar] true") ~= nil
end
return self:GetAttribute("value"..slot) ~= nil`
						: `if self:GetAttribute("kind"..slot) == "action" then
	return SecureCmdOptionParse("[extrabar] true") ~= nil and HasAction(slot)
end
return self:GetAttribute("value"..slot) ~= nil`,
			position: `local state = GetGamePadState()
local pos = state and state.sticks and state.sticks[${rightStick}]
if pos then return pos.x, pos.y, pos.len end`,
			stick: "Right",
			virtualStick: "Camera",
		};
	}
	private classEntries(): RingEntry[] {
		const [, className] = (
			UnitClass as unknown as (
				this: void,
				unit: string,
			) => LuaMultiReturn<[string, string]>
		)("player");
		const entries: RingEntry[] = [];
		if (className === "HUNTER" || className === "WARLOCK") {
			// Keep native slot identities ready even when the pet is dismissed. A pet
			// summoned in combat must work without insecure attribute changes.
			for (let index = 1; index <= 10; index++) {
				entries.push({ slot: index, type: "pet", value: index });
			}
		} else if (["DRUID", "WARRIOR", "SHAMAN"].includes(className)) {
			for (let index = 1; index <= GetNumShapeshiftForms(); index++) {
				const [icon, , , spell] = GetShapeshiftFormInfo(index);
				if (spell)
					entries.push({
						slot: entries.length + 1,
						type: "spell",
						value: spell,
						icon,
					});
			}
		}
		return entries;
	}
	private utilityEntries(): RingEntry[] {
		// Retail's extra-action page is 19; 169 belongs to normal Edit Mode bar 8.
		const extra = ExtraActionButton1?.action ?? 217;
		const entries: RingEntry[] = [
			{ slot: extra, type: "action", value: extra },
		];
		const items = new Set<number>();
		const addItem = (id: number, icon?: number) => {
			if (items.has(id)) return;
			items.add(id);
			entries.push({
				slot: entries.length,
				type: "item",
				value: `item:${id}`,
				icon,
			});
		};
		const [count] = C_QuestLog.GetNumQuestLogEntries();
		for (let index = 1; index <= count; index++) {
			const [link, icon] = GetQuestLogSpecialItemInfo(index);
			if (!link) continue;
			const id = (
				C_Item.GetItemIDForItemInfo as unknown as (
					this: void,
					info: string,
				) => number | undefined
			)(link);
			if (id) addItem(id, icon);
		}
		for (let bag = 0; bag <= 5; bag++) {
			for (
				let slot = 1;
				slot <= C_Container.GetContainerNumSlots(bag);
				slot++
			) {
				const quest = C_Container.GetContainerItemQuestInfo(
					bag,
					slot,
				) as unknown as { isQuestItem: boolean };
				if (!quest?.isQuestItem) continue;
				const id = C_Container.GetContainerItemID(bag, slot);
				if (!id) continue;
				const [usable] = C_Item.IsUsableItem(id);
				if (usable) addItem(id, C_Item.GetItemIconByID(id) ?? undefined);
			}
		}
		const spells = new Set<number>();
		const abilities = C_ZoneAbility.GetActiveAbilities() as unknown as {
			spellID: number;
			uiPriority: number;
		}[];
		abilities.sort((a, b) => a.uiPriority - b.uiPriority);
		for (const ability of abilities) {
			if (spells.has(ability.spellID)) continue;
			spells.add(ability.spellID);
			entries.push({
				slot: entries.length,
				type: "spell",
				value: ability.spellID,
				icon: C_ZoneAbility.GetZoneAbilityIcon(ability.spellID) ?? undefined,
			});
		}
		return entries;
	}
	readRing(kind: ActionRingKind, slot: number): SlotVisual {
		if (kind === "abilities")
			return { ...this.read(slot), name: this.actionName(slot) };
		const entry = this.ringEntries
			.get(kind)
			?.find((candidate) => candidate.slot === slot);
		if (!entry) return {};
		if (entry.type === "action")
			return {
				...this.read(Number(entry.value)),
				name: this.actionName(Number(entry.value)),
			};
		if (entry.type === "pet") {
			const [name, texture, token, , , , spell] = GetPetActionInfo(
				Number(entry.value),
			);
			const icon =
				token && typeof texture === "string"
					? (_G as unknown as Record<string, string | number | undefined>)[
							texture
						]
					: texture;
			return {
				icon,
				name:
					token && name
						? ((_G as unknown as Record<string, string>)[name] ?? name)
						: name,
				...(spell ? this.spellVisual(spell) : {}),
			};
		}
		if (entry.type === "spell")
			return { ...this.spellVisual(Number(entry.value)), icon: entry.icon };
		const item = Number(String(entry.value).replace("item:", ""));
		return {
			icon: entry.icon,
			name: C_Item.GetItemNameByID(item) ?? undefined,
		};
	}
	private actionName(slot: number): string | undefined {
		const [kind, id] = GetActionInfo(slot);
		if (kind === "spell") return C_Spell.GetSpellName(id);
		if (kind === "item") return C_Item.GetItemNameByID(id) ?? undefined;
		return C_ActionBar.GetActionText(slot);
	}
	private spellVisual(spell: number): SlotVisual {
		return {
			name: C_Spell.GetSpellName(spell),
			cooldown: C_Spell.GetSpellCooldownDuration(spell, false) as unknown as
				| CooldownDuration
				| undefined,
			recharge: C_Spell.GetSpellChargeDuration(spell) as unknown as
				| CooldownDuration
				| undefined,
		};
	}
	syncBuiltInVisibility(): void {
		if (!this.canModify()) return;
		const [kind] = (
			GetCursorInfo as unknown as (
				this: void,
			) => LuaMultiReturn<[string | undefined]>
		)();
		if (
			kind &&
			[
				"spell",
				"macro",
				"item",
				"flyout",
				"petaction",
				"mount",
				"outfit",
			].includes(kind)
		) {
			if (this.suppressed) {
				this.frames.restore();
				this.suppressed = false;
			}
		} else this.disableBuiltIn();
	}
	read(slot: number): SlotVisual {
		// 150544 supplies the journal icon; summoning uses SummonByID(0), not a cast.
		if (slot === -3) {
			const [icon] = C_Spell.GetSpellTexture(150544);
			return { icon };
		}
		if (slot === -2) {
			// Generated declarations flatten this table and alter Blizzard's field casing.
			const abilities = C_ZoneAbility.GetActiveAbilities() as unknown as {
				spellID: number;
				uiPriority: number;
			}[];
			let ability: (typeof abilities)[number] | undefined;
			for (const candidate of abilities)
				if (!ability || candidate.uiPriority < ability.uiPriority)
					ability = candidate;
			if (!ability) return {};
			return {
				spell: ability.spellID,
				icon: C_ZoneAbility.GetZoneAbilityIcon(ability.spellID) ?? undefined,
				cooldown: C_Spell.GetSpellCooldownDuration(
					ability.spellID,
					false,
				) as unknown as CooldownDuration | undefined,
				recharge: C_Spell.GetSpellChargeDuration(ability.spellID) as unknown as
					| CooldownDuration
					| undefined,
			};
		}
		if (slot === -1) return { icon: "Interface\\Icons\\INV_Misc_EngGizmos_19" };
		// Zero is the presentation state for the native jump binding, not an action slot.
		if (slot === 0)
			return { icon: "Interface\\AddOns\\SteamDeckUI\\assets\\Jump.png" };
		// Generated declarations currently flatten LuaDurationObject into number.
		return {
			icon: C_ActionBar.GetActionTexture(slot),
			cooldown: C_ActionBar.GetActionCooldownDuration(slot, false) as unknown as
				| CooldownDuration
				| undefined,
			recharge: C_ActionBar.GetActionChargeDuration(slot) as unknown as
				| CooldownDuration
				| undefined,
		};
	}
	bind(bindings: readonly ActionBinding[]): void {
		for (const { key, target, defaultCommand, prefixes } of bindings) {
			if (!this.owners.includes(target.owner)) this.owners.push(target.owner);
			for (const prefix of prefixes ?? ["", "SHIFT-", "CTRL-", "CTRL-SHIFT-"]) {
				if (prefix === "" && defaultCommand)
					SetOverrideBinding(target.owner, false, key, defaultCommand);
				else
					SetOverrideBindingClick(
						target.owner,
						false,
						`${prefix}${key}`,
						target.name,
						"LeftButton",
					);
			}
		}
	}
	restore(): void {
		for (const owner of this.owners) ClearOverrideBindings(owner);
		this.owners.length = 0;
		this.frames.restore();
		this.suppressed = false;
	}
}
