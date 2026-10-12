import type { WowFrame } from "../types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";
import type { RadialDriver } from "../ui/components/secure-radial-menu";
import type {
	BindingTarget,
	CooldownDuration,
	SlotDriver,
	SlotVisual,
} from "../ui/components/secure-slot-button";

type NativeBar = WowFrame & { GetParent(): WowFrame | undefined };
declare global {
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
		defaultCommand?: "JUMP" | "RING" | "EXTRA",
	): SlotDriver;
	getRingDriver(): RadialDriver;
	read(slot: number): SlotVisual;
	bind(bindings: readonly ActionBinding[]): void;
	restore(): void;
}
export class ActionBarClient implements IActionBarClient {
	private suppressed = false;
	private readonly owners: WowFrame[] = [];
	constructor(private readonly frames: IFrameSuppression) {}
	canModify(): boolean {
		return !InCombatLockdown();
	}
	disableBuiltIn(): void {
		if (this.suppressed) return;
		this.frames.suppress([
			MainActionBar,
			MultiBarBottomLeft,
			MultiBarBottomRight,
			MultiBarLeft,
			MultiBarRight,
			MultiBar5,
			MultiBar6,
			MultiBar7,
		]);
		this.suppressed = true;
	}
	getSlotDriver(
		slot: number,
		defaultCommand?: "JUMP" | "RING" | "EXTRA",
	): SlotDriver {
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
			condition: `[mod:shift,mod:ctrl] ${168 + slot}; [mod:shift] ${144 + slot}; [mod:ctrl] ${156 + slot}; ${defaultCommand === "JUMP" ? "0" : defaultCommand === "RING" ? "-1" : defaultCommand === "EXTRA" ? "[extrabar] 169; -2" : mainConditions}`,
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
${defaultCommand === "EXTRA" ? 'self:SetAttribute("type", action == -2 and "spell" or "action")\n' : ""}self:SetAttribute("action", action)`,
		};
	}
	getRingDriver(): RadialDriver {
		// Edit Mode bar 5 is MultiBarLeft, action page 4 (slots 37–48).
		let rightStick = 2;
		for (let index = 0; index < 8; index++) {
			const name = C_GamePad.StickIndexToConfigName(index);
			if (!name) break;
			if (name === "Right") {
				rightStick = index + 1;
				break;
			}
		}
		return {
			slots: Array.from({ length: 12 }, (_, i) => 37 + i),
			occupied: "return HasAction(slot)",
			position: `local state = GetGamePadState()
local pos = state and state.sticks and state.sticks[${rightStick}]
if pos then return pos.x, pos.y, pos.len end`,
			stick: "Right",
			virtualStick: "Camera",
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
