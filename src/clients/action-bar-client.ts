import type { WowFrame } from "../types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";
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
}
export interface IActionBarClient {
	canModify(): boolean;
	disableBuiltIn(): void;
	syncBuiltInVisibility(): void;
	getSlotDriver(slot: number, defaultCommand?: "JUMP"): SlotDriver;
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
	getSlotDriver(slot: number, defaultCommand?: "JUMP"): SlotDriver {
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
			condition: `[mod:shift,mod:ctrl] ${168 + slot}; [mod:shift] ${144 + slot}; [mod:ctrl] ${156 + slot}; ${defaultCommand === "JUMP" ? "0" : mainConditions}`,
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
self:SetAttribute("action", action)`,
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
		for (const { key, target, defaultCommand } of bindings) {
			if (!this.owners.includes(target.owner)) this.owners.push(target.owner);
			for (const prefix of ["", "SHIFT-", "CTRL-", "CTRL-SHIFT-"]) {
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
