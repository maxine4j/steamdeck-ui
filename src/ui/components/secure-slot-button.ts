import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { type CooldownDuration, CooldownOverlay } from "./cooldown-overlay";
import { applyIconOutline } from "./skin";

export type { CooldownDuration } from "./cooldown-overlay";
export interface BindingTarget {
	readonly owner: WowFrame;
	readonly name: string;
}
export interface SlotVisual {
	name?: string;
	spell?: number;
	icon?: number | string;
	cooldown?: CooldownDuration;
	recharge?: CooldownDuration;
}
export type SlotReader = (this: void, slot: number) => SlotVisual;
export interface SlotDriver {
	readonly condition: string;
	readonly response: string;
}
type SecureFrame = WowFrame & {
	GetName(): string;
	GetAttribute(name: string): number | undefined;
	SetAttribute(name: string, value?: string | number | boolean): void;
	HookScript(
		script: "OnAttributeChanged",
		handler: (this: void, frame: WowFrame, name: string) => void,
	): void;
};
declare global {
	function RegisterStateDriver(
		this: void,
		frame: WowFrame,
		state: string,
		condition: string,
	): void;
	function UnregisterStateDriver(
		this: void,
		frame: WowFrame,
		state: string,
	): void;
}

/** Generic secure action slot, driven entirely by its supplied macro condition. */
export class SecureSlotButton {
	private readonly frame: SecureFrame;
	private readonly cooldowns: CooldownOverlay;
	private readonly label;
	private read?: SlotReader;
	constructor(private readonly pool: IFramePoolManager) {
		this.frame = pool.acquire("SecureStateButton") as SecureFrame;
		this.frame.SetParent(UIParent);
		this.cooldowns = new CooldownOverlay(pool, this.frame);
		this.label = this.frame.CreateFontString(
			undefined,
			"OVERLAY",
			"GameFontNormal",
		);
		this.label.SetFont("Fonts\\FRIZQT__.TTF", 14, "OUTLINE");
		this.label.SetPoint("TOPLEFT", this.frame, "TOPLEFT", 4, -4);
		// Preserve the secure template's state handler; replacing it breaks combat paging.
		this.frame.HookScript("OnAttributeChanged", (_frame, name) => {
			if (name === "action" && this.read) this.refresh(this.read);
		});
	}
	configure(
		label: string,
		x: number,
		y: number,
		initialSlot: number,
		driver: string | SlotDriver,
		read: SlotReader,
	): void {
		this.frame.SetSize(48, 48);
		applyIconOutline(this.pool, this.frame);
		this.read = undefined;
		this.frame.ClearAllPoints();
		this.frame.SetPoint("BOTTOM", UIParent, "BOTTOM", x, y);
		this.label.SetText(label);
		this.frame.RegisterForClicks("AnyUp");
		this.frame.RegisterForDrag("LeftButton");
		this.frame.SetAttribute("type", "action");
		this.frame.SetAttribute("useOnKeyDown", false);
		this.frame.SetAttribute("action", initialSlot);
		// The secure drag template picks up the current page's slot without a modifier.
		this.frame.SetAttribute(
			"_ondragstart",
			`local action = self:GetAttribute("action")
if button == "LeftButton" and action and action > 0 and not SecureCmdOptionParse("[combat] true") then
	return "action", action
end`,
		);
		this.frame.SetAttribute(
			"_onstate-slot",
			typeof driver === "string"
				? 'self:SetAttribute("action", tonumber(newstate))'
				: driver.response,
		);
		RegisterStateDriver(
			this.frame,
			"slot",
			typeof driver === "string" ? driver : driver.condition,
		);
		this.read = read;
		this.refresh(read);
		this.frame.Show();
	}
	getBindingTarget(): BindingTarget {
		return { owner: this.frame, name: this.frame.GetName() };
	}
	setSpell(spell?: number): void {
		this.frame.SetAttribute("spell", spell);
	}
	refresh(read: SlotReader): void {
		const slot = this.frame.GetAttribute("action");
		if (slot === undefined) return;
		const visual = read(slot);
		const texture = this.pool.getBackground(this.frame);
		texture.SetAtlas("UI-HUD-ActionBar-IconFrame-Background", false);
		if (visual.icon !== undefined) texture.SetTexture(visual.icon);
		texture.SetTexCoord(0, 1, 0, 1);
		this.cooldowns.refresh(visual.cooldown, visual.recharge);
	}
	destroy(): void {
		this.read = undefined;
		UnregisterStateDriver(this.frame, "slot");
		for (const attribute of [
			"type",
			"action",
			"spell",
			"macrotext",
			"useOnKeyDown",
			"_ondragstart",
			"_onstate-slot",
			"state-slot",
		])
			this.frame.SetAttribute(attribute, undefined);
		this.frame.RegisterForClicks("LeftButtonUp");
		this.frame.RegisterForDrag();
		this.label.SetText("");
		this.cooldowns.destroy();
		this.pool.release("SecureStateButton", this.frame);
	}
}
