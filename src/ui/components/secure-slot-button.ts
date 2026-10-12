import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { setBorder } from "./border";

/** Opaque native duration: cooldown values can be secret in combat. */
export interface CooldownDuration {
	readonly durationObject?: never;
}
export interface BindingTarget {
	readonly owner: WowFrame;
	readonly name: string;
}
export interface SlotVisual {
	icon?: number;
	cooldown?: CooldownDuration;
	recharge?: CooldownDuration;
}
export type SlotReader = (this: void, slot: number) => SlotVisual;
type SecureFrame = WowFrame & {
	GetName(): string;
	GetAttribute(name: string): number | undefined;
	SetAttribute(name: string, value?: string | number | boolean): void;
	HookScript(
		script: "OnAttributeChanged",
		handler: (this: void, frame: WowFrame, name: string) => void,
	): void;
};
interface CooldownFrame extends WowFrame {
	SetCooldownFromDurationObject(
		duration: CooldownDuration,
		clearIfZero: boolean,
	): void;
	SetHideCountdownNumbers(hide: boolean): void;
	SetDrawEdge(draw: boolean): void;
	SetDrawSwipe(draw: boolean): void;
	SetCountdownFormatter(formatter?: SecondsFormatter): void;
	Clear(): void;
}
interface SecondsFormatter {
	SetMaxInterval(interval: number): void;
	SetMinInterval(interval: number): void;
	SetMillisecondsThreshold(seconds: number): void;
}
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
	private readonly cooldowns: CooldownFrame[];
	private readonly label;
	private read?: SlotReader;
	constructor(private readonly pool: IFramePoolManager) {
		this.frame = pool.acquire("SecureStateButton") as SecureFrame;
		this.frame.SetParent(UIParent);
		const formatter =
			C_StringUtil.CreateSecondsFormatter() as unknown as SecondsFormatter;
		// SecondsFormatterInterval.Seconds = 0; keep long cooldowns in seconds too.
		formatter.SetMaxInterval(0);
		formatter.SetMinInterval(0);
		formatter.SetMillisecondsThreshold(0);
		this.cooldowns = [0, 1].map(() => {
			const cooldown = pool.acquire("Cooldown") as CooldownFrame;
			cooldown.SetParent(this.frame);
			// Replace template anchors, which can still point to UIParent.
			cooldown.ClearAllPoints();
			cooldown.SetPoint("TOPLEFT", this.frame, "TOPLEFT", 2, -2);
			cooldown.SetPoint("BOTTOMRIGHT", this.frame, "BOTTOMRIGHT", -2, 2);
			cooldown.SetHideCountdownNumbers(false);
			cooldown.SetCountdownFormatter(formatter);
			cooldown.SetDrawEdge(false);
			cooldown.SetDrawSwipe(true);
			cooldown.Show();
			return cooldown;
		});
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
		driver: string,
		read: SlotReader,
	): void {
		this.frame.SetSize(48, 48);
		setBorder(this.pool, this.frame, [0.42, 0.47, 0.55, 1]);
		this.read = undefined;
		this.frame.ClearAllPoints();
		this.frame.SetPoint("BOTTOM", UIParent, "BOTTOM", x, y);
		this.label.SetText(label);
		this.frame.RegisterForClicks("AnyDown", "AnyUp");
		this.frame.SetAttribute("type", "action");
		this.frame.SetAttribute("useOnKeyDown", true);
		this.frame.SetAttribute("action", initialSlot);
		this.frame.SetAttribute(
			"_onstate-slot",
			'self:SetAttribute("action", tonumber(newstate))',
		);
		RegisterStateDriver(this.frame, "slot", driver);
		this.read = read;
		this.refresh(read);
		this.frame.Show();
	}
	getBindingTarget(): BindingTarget {
		return { owner: this.frame, name: this.frame.GetName() };
	}
	refresh(read: SlotReader): void {
		const slot = this.frame.GetAttribute("action");
		if (slot === undefined) return;
		const visual = read(slot);
		const texture = this.pool.getBackground(this.frame);
		texture.SetColorTexture(0.08, 0.08, 0.1, 0.9);
		if (visual.icon !== undefined) texture.SetTexture(visual.icon);
		texture.SetTexCoord(0.07, 0.93, 0.07, 0.93);
		this.updateCooldown(this.cooldowns.at(0), visual.recharge);
		this.updateCooldown(this.cooldowns.at(1), visual.cooldown);
	}
	private updateCooldown(
		frame: CooldownFrame | undefined,
		duration: CooldownDuration | undefined,
	): void {
		if (!frame) return;
		if (duration === undefined) frame.Clear();
		else frame.SetCooldownFromDurationObject(duration, true);
	}
	destroy(): void {
		this.read = undefined;
		UnregisterStateDriver(this.frame, "slot");
		for (const attribute of [
			"type",
			"action",
			"useOnKeyDown",
			"_onstate-slot",
			"state-slot",
		])
			this.frame.SetAttribute(attribute, undefined);
		this.frame.RegisterForClicks("LeftButtonUp");
		this.label.SetText("");
		for (const cooldown of this.cooldowns) {
			cooldown.Clear();
			cooldown.SetCountdownFormatter(undefined);
			this.pool.release("Cooldown", cooldown);
		}
		this.pool.release("SecureStateButton", this.frame);
	}
}
