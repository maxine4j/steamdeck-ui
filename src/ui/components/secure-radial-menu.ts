import type { WowFontString, WowFrame, WowLine } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { setBorder } from "./border";
import { CooldownOverlay } from "./cooldown-overlay";
import { RADIAL_INDEX_SNIPPET, radialIndex } from "./radial-selection";
import type { BindingTarget, SlotReader } from "./secure-slot-button";

const RING_RADIUS = 130;
const INNER_RADIUS = 62;
const WHEEL_SEGMENTS = 128;

/** API-specific queries are supplied by a client, executed in WoW's restricted environment. */
export interface RadialDriver {
	readonly slots: readonly number[];
	readonly actions?: readonly RadialAction[];
	/** Receives the candidate action slot through ... and returns whether it exists. */
	readonly occupied: string;
	readonly position: string;
	readonly stick: string;
	readonly virtualStick: string;
}
export interface RadialAction {
	readonly slot: number;
	readonly type: "action" | "pet" | "spell" | "item";
	readonly value: number | string;
}
interface RadialFrame extends WowFrame {
	EnableMouse(enabled: boolean): void;
	SetFrameStrata(
		strata:
			| "PARENT"
			| "DIALOG"
			| "FULLSCREEN_DIALOG"
			| "BACKGROUND"
			| "TOOLTIP",
	): void;
	GetName(): string;
	GetAttribute(name: string): number | undefined;
	SetAttribute(name: string, value?: string | number | boolean): void;
	SetFrameRef(name: string, frame: WowFrame): void;
	SetScript(script: "OnShow" | "OnHide", handler?: (this: void) => void): void;
	SetScript(
		script: "OnUpdate",
		handler?: (this: void, frame: WowFrame, elapsed: number) => void,
	): void;
	SetScript(
		script: "OnGamePadStick",
		handler?: (
			this: void,
			frame: WowFrame,
			stick: string,
			x: number,
			y: number,
			length: number,
		) => void,
	): void;
	SetScript(
		script: "OnClick" | "OnDragStart" | "OnEnter" | "OnLeave",
		handler?: (this: void, frame: WowFrame, button: string) => void,
	): void;
	SetScript(
		script: "OnMouseWheel",
		handler?: (this: void, frame: WowFrame, delta: number) => void,
	): void;
	EnableGamePadStick(enabled: boolean): void;
	SetPropagateKeyboardInput(enabled: boolean): void;
}
declare global {
	function SecureHandlerWrapScript(
		this: void,
		frame: WowFrame,
		script: string,
		header: WowFrame,
		preBody: string,
		postBody?: string,
	): void;
	function SecureHandlerUnwrapScript(
		this: void,
		frame: WowFrame,
		script: string,
	): void;
	function SecureHandlerExecute(
		this: void,
		frame: WowFrame,
		body: string,
	): void;
}

/** Pooled hold/release radial action control. Only secure code changes action attributes. */
export class SecureRadialMenu {
	private readonly trigger: RadialFrame;
	private readonly display: RadialFrame;
	private readonly listener: RadialFrame;
	private readonly blocker: RadialFrame;
	private readonly items: RadialFrame[];
	private readonly cooldowns: CooldownOverlay[];
	private readonly label: WowFontString;
	private readonly pointer: WowLine;
	private readonly wheel: WowLine[];
	private readonly centerBackground: WowLine[];
	private readonly separators: WowLine[];
	private readonly center: WowFontString;
	private readonly names = new Map<number, string>();
	private selected?: number;
	private read?: SlotReader;
	private inputActive = false;
	private releaseGraceRemaining = 0;
	private slots: readonly number[] = [];
	constructor(
		private readonly pool: IFramePoolManager,
		capacity: number,
	) {
		this.trigger = pool.acquire("SecureRingButton") as RadialFrame;
		this.display = pool.acquire("SecureFrame") as RadialFrame;
		this.listener = pool.acquire("Frame") as RadialFrame;
		this.blocker = pool.acquire("Frame") as RadialFrame;
		this.items = Array.from(
			{ length: capacity },
			() => pool.acquire("SecureFrame") as RadialFrame,
		);
		this.cooldowns = this.items.map((item) => new CooldownOverlay(pool, item));
		this.label = this.display.CreateFontString(
			undefined,
			"OVERLAY",
			"GameFontNormal",
		);
		this.pointer = pool.getLine(this.display, "radial-pointer");
		this.center = this.display.CreateFontString(
			undefined,
			"OVERLAY",
			"GameFontNormalLarge",
		);
		this.wheel = Array.from({ length: WHEEL_SEGMENTS }, (_, i) =>
			pool.getLine(this.display, `radial-fill-${i}`, "BACKGROUND"),
		);
		this.centerBackground = Array.from({ length: INNER_RADIUS }, (_, i) =>
			pool.getLine(this.display, `radial-center-${i}`, "BACKGROUND"),
		);
		this.separators = [];
	}
	configure(
		key: string,
		driver: RadialDriver,
		read: SlotReader,
		caption = "",
		releaseGraceSeconds = 0,
	): void {
		this.read = read;
		this.trigger.SetParent(UIParent);
		this.trigger.SetSize(1, 1);
		this.trigger.SetPoint("CENTER", UIParent, "CENTER", 0, 0);
		this.trigger.RegisterForClicks("AnyDown", "AnyUp");
		this.trigger.SetAttribute("useOnKeyDown", true);
		this.trigger.SetAttribute("pressAndHoldAction", true);
		this.trigger.SetAttribute(
			"occupied",
			`local slot = ...\n${driver.occupied}`,
		);
		this.trigger.SetAttribute("position", driver.position);
		this.trigger.SetAttribute("binding", key);
		this.trigger.SetFrameRef("display", this.display);
		this.display.SetParent(this.trigger);
		this.display.SetSize(360, 360);
		this.display.SetPoint("CENTER", this.trigger, "CENTER", 0, 0);
		this.display.SetFrameStrata("DIALOG");
		this.label.SetPoint("TOP", this.display, "BOTTOM", 0, -8);
		this.label.SetText(caption);
		this.center.SetPoint("CENTER", this.display, "CENTER", 0, 0);
		this.center.SetWidth(112);
		this.center.SetWordWrap(true);
		this.center.SetText("");
		// Non-overlapping horizontal chords keep the disk's opacity uniform.
		for (let i = 0; i < this.centerBackground.length; i++) {
			const line = this.centerBackground.at(i);
			if (!line) continue;
			const y = i * 2 - INNER_RADIUS + 1;
			const x = Math.sqrt(INNER_RADIUS * INNER_RADIUS - y * y);
			line.SetStartPoint("CENTER", this.display, -x, y);
			line.SetEndPoint("CENTER", this.display, x, y);
			line.SetThickness(2);
			line.SetColorTexture(0.025, 0.035, 0.05, 0.8);
			line.Show();
		}
		this.pointer.SetThickness(3);
		this.pointer.SetStartPoint("CENTER", this.display, 0, 0);
		this.pointer.Hide();
		this.setActions(driver);
		// See ConsolePort's raw Right -> virtual Camera dispatch. Propagation is
		// configured once out of combat; only blocker visibility changes at runtime.
		this.listener.SetParent(UIParent);
		this.blocker.SetParent(UIParent);
		this.listener.SetFrameStrata("BACKGROUND");
		this.blocker.SetFrameStrata("TOOLTIP");
		this.listener.SetPropagateKeyboardInput(true);
		this.blocker.SetPropagateKeyboardInput(false);
		this.listener.EnableGamePadStick(true);
		this.blocker.EnableGamePadStick(true);
		this.listener.SetScript("OnGamePadStick", (_frame, stick, x, y, length) => {
			if (stick !== driver.stick) return;
			if (!this.inputActive && this.releaseGraceRemaining <= 0) return;
			if (this.inputActive) this.highlight(x, y, length);
			this.blocker.Show();
		});
		this.listener.SetScript("OnUpdate", (_frame, elapsed) => {
			this.blocker.Hide();
			if (this.inputActive || this.releaseGraceRemaining <= 0) return;
			this.releaseGraceRemaining = Math.max(
				0,
				this.releaseGraceRemaining - elapsed,
			);
			if (this.releaseGraceRemaining === 0) this.listener.Hide();
		});
		this.blocker.SetScript("OnGamePadStick", (_frame, stick) => {
			if (stick === driver.virtualStick) this.blocker.Hide();
		});
		this.display.SetScript("OnShow", () => {
			this.selected = undefined;
			this.center.SetText("");
			this.inputActive = true;
			this.releaseGraceRemaining = 0;
			this.pointer.Hide();
			this.refresh();
			this.listener.Show();
		});
		this.display.SetScript("OnHide", () => {
			this.selected = undefined;
			this.center.SetText("");
			this.pointer.Hide();
			if (!this.inputActive) return;
			this.inputActive = false;
			this.releaseGraceRemaining = Math.max(0, releaseGraceSeconds);
			if (this.releaseGraceRemaining === 0) {
				this.listener.Hide();
				this.blocker.Hide();
			}
		});
		this.listener.Hide();
		this.blocker.Hide();
		this.display.Hide();
		SecureHandlerWrapScript(
			this.trigger,
			"PreClick",
			this.trigger,
			`
self:SetAttribute("type", nil)
self:SetAttribute("typerelease", nil)
self:SetAttribute("action", nil)
self:SetAttribute("spell", nil)
self:SetAttribute("item", nil)
local display = self:GetFrameRef("display")
if down then
	if self:GetAttribute("held") then return end
	local count = 0
	for i = 1, self:GetAttribute("capacity") do
		local slot = self:GetAttribute("slot"..i)
		if self:RunAttribute("occupied", slot) then
			count = count + 1
			self:SetAttribute("active"..count, slot)
		end
	end
	self:SetAttribute("count", count)
	display:SetAttribute("count", count)
	for i = 1, self:GetAttribute("capacity") do
		local item = self:GetFrameRef("item"..i)
		item:Hide()
		if i <= count then
			local angle = (i - 1) * math.pi * 2 / count
			local radius = ${RING_RADIUS}
			item:SetAttribute("slot", self:GetAttribute("active"..i))
			item:ClearAllPoints()
			item:SetPoint("CENTER", display, "CENTER", math.sin(angle) * radius, math.cos(angle) * radius)
			item:Show()
		end
	end
	self:SetAttribute("held", true)
	-- Capture modified releases too, if a modifier changes while held.
	for modifiers = 0, 7 do
		local prefix = ""
		if modifiers % 2 == 1 then prefix = "SHIFT-" end
		if math.floor(modifiers / 2) % 2 == 1 then prefix = "CTRL-"..prefix end
		if modifiers >= 4 then prefix = "ALT-"..prefix end
		self:SetBindingClick(true, prefix..self:GetAttribute("binding"), self:GetName(), "LeftButton")
	end
	if count > 0 then display:Show() end
else
	if not self:GetAttribute("held") then return end
	local count = self:GetAttribute("count")
	local x, y, len = self:RunAttribute("position")
	local index
${RADIAL_INDEX_SNIPPET}
	if index then
		local slot = self:GetAttribute("active"..index)
		if self:RunAttribute("occupied", slot) then
			local kind = self:GetAttribute("kind"..slot)
			if kind then
				local attribute = kind == "pet" and "action" or kind
				self:SetAttribute(attribute, self:GetAttribute("value"..slot))
				self:SetAttribute("typerelease", kind)
			else
				self:SetAttribute("action", slot)
				self:SetAttribute("typerelease", "action")
			end
		end
	end
	self:SetAttribute("held", nil)
	self:ClearBindings()
	-- Temporary hold bindings share the owner with the permanent trigger binding.
	self:SetBindingClick(false, self:GetAttribute("binding"), self:GetName(), "LeftButton")
	display:Hide()
end`,
		);
		this.trigger.Show();
	}
	/** Called out of combat; preserves pooled controls and the installed secure handler. */
	setActions(driver: Pick<RadialDriver, "slots" | "actions">): void {
		for (const slot of this.slots) {
			this.trigger.SetAttribute(`kind${slot}`, undefined);
			this.trigger.SetAttribute(`value${slot}`, undefined);
		}
		this.slots = driver.slots;
		while (this.items.length < driver.slots.length) {
			const item = this.pool.acquire("SecureFrame") as RadialFrame;
			this.items.push(item);
			this.cooldowns.push(new CooldownOverlay(this.pool, item));
		}
		this.display.Hide();
		this.trigger.SetAttribute("capacity", driver.slots.length);
		for (let i = 0; i < this.items.length; i++) {
			const item = this.items.at(i);
			if (!item) continue;
			item.SetParent(this.display);
			item.SetSize(48, 48);
			item.EnableMouse(true);
			item.Hide();
			this.trigger.SetAttribute(`slot${i + 1}`, driver.slots.at(i));
			this.trigger.SetFrameRef(`item${i + 1}`, item);
			item.SetScript("OnEnter", () => {
				const count = this.display.GetAttribute("count") ?? 0;
				if (!this.inputActive || i >= count) return;
				const angle = (i * Math.PI * 2) / count;
				this.highlight(Math.sin(angle), Math.cos(angle), 1);
			});
			item.SetScript("OnLeave", () => {
				if (this.inputActive) this.highlight(0, 0, 0);
			});
			if (!this.separators.at(i))
				this.separators.push(
					this.pool.getLine(this.display, `radial-divider-${i}`),
				);
		}
		for (const action of driver.actions ?? []) {
			this.trigger.SetAttribute(`kind${action.slot}`, action.type);
			this.trigger.SetAttribute(`value${action.slot}`, action.value);
		}
	}
	getBindingTarget(): BindingTarget {
		return { owner: this.trigger, name: this.trigger.GetName() };
	}
	refresh(): void {
		if (!this.read) return;
		const count = this.display.GetAttribute("count") ?? 0;
		for (let i = 0; i < count; i++) {
			const item = this.items.at(i);
			const slot = item?.GetAttribute("slot");
			if (!item || slot === undefined) continue;
			const texture = this.pool.getBackground(item);
			const visual = this.read(slot);
			this.names.set(i + 1, visual.name ?? "");
			texture.SetTexture(visual.icon);
			texture.SetTexCoord(0.07, 0.93, 0.07, 0.93);
			this.cooldowns.at(i)?.refresh(visual.cooldown, visual.recharge);
			setBorder(this.pool, item, [0.42, 0.47, 0.55, 1]);
		}
		this.drawWheel(count);
		this.center.SetText(
			this.selected ? (this.names.get(this.selected) ?? "") : "",
		);
	}
	private drawWheel(count: number): void {
		for (let i = 0; i < this.wheel.length; i++) {
			const line = this.wheel.at(i);
			if (!line) continue;
			const angle = (i * Math.PI * 2) / WHEEL_SEGMENTS;
			const x = Math.sin(angle),
				y = Math.cos(angle);
			line.SetStartPoint(
				"CENTER",
				this.display,
				x * INNER_RADIUS,
				y * INNER_RADIUS,
			);
			line.SetEndPoint("CENTER", this.display, x * 172, y * 172);
			line.SetThickness(9);
			if (
				this.selected !== undefined &&
				radialIndex(x, y, 1, count) === this.selected
			)
				line.SetColorTexture(0.65, 0.43, 0.12, 0.92);
			else line.SetColorTexture(0.055, 0.07, 0.1, 0.94);
			line.Show();
		}
		for (let i = 0; i < this.separators.length; i++) {
			const line = this.separators.at(i);
			if (!line) continue;
			if (i >= count || count < 2) {
				line.Hide();
				continue;
			}
			const angle = ((i + 0.5) * Math.PI * 2) / count;
			const x = Math.sin(angle),
				y = Math.cos(angle);
			line.SetStartPoint(
				"CENTER",
				this.display,
				x * INNER_RADIUS,
				y * INNER_RADIUS,
			);
			line.SetEndPoint("CENTER", this.display, x * 172, y * 172);
			line.SetThickness(2);
			line.SetColorTexture(0.42, 0.47, 0.55, 0.8);
			line.Show();
		}
	}
	private highlight(x: number, y: number, length: number): void {
		const count = this.display.GetAttribute("count") ?? 0;
		const index = radialIndex(x, y, length, count);
		if (index !== this.selected) {
			this.selected = index;
			this.drawWheel(count);
			this.center.SetText(index ? (this.names.get(index) ?? "") : "");
		}
		const magnitude = Math.sqrt(x * x + y * y);
		if (count > 0 && magnitude > 0 && length > 0) {
			const distance =
				INNER_RADIUS + (RING_RADIUS - INNER_RADIUS) * Math.min(length, 1);
			this.pointer.SetStartPoint(
				"CENTER",
				this.display,
				(x / magnitude) * INNER_RADIUS,
				(y / magnitude) * INNER_RADIUS,
			);
			this.pointer.SetEndPoint(
				"CENTER",
				this.display,
				(x / magnitude) * distance,
				(y / magnitude) * distance,
			);
			if (index === undefined)
				this.pointer.SetColorTexture(0.65, 0.7, 0.8, 0.45);
			else this.pointer.SetColorTexture(1, 0.82, 0, 0.9);
			this.pointer.Show();
		} else this.pointer.Hide();
		for (let i = 0; i < count; i++) {
			const item = this.items.at(i);
			if (item)
				setBorder(
					this.pool,
					item,
					index === i + 1 ? [1, 0.82, 0, 1] : [0.42, 0.47, 0.55, 1],
					index === i + 1 ? 4 : 2,
				);
		}
	}
	destroy(): void {
		this.inputActive = false;
		this.releaseGraceRemaining = 0;
		SecureHandlerExecute(this.trigger, "self:ClearBindings()");
		SecureHandlerUnwrapScript(this.trigger, "PreClick");
		this.label.SetText("");
		this.center.SetText("");
		this.names.clear();
		this.read = undefined;
		this.display.SetScript("OnShow", undefined);
		this.display.SetScript("OnHide", undefined);
		this.listener.SetScript("OnGamePadStick", undefined);
		this.listener.SetScript("OnUpdate", undefined);
		this.blocker.SetScript("OnGamePadStick", undefined);
		this.listener.EnableGamePadStick(false);
		this.blocker.EnableGamePadStick(false);
		this.blocker.SetPropagateKeyboardInput(true);
		for (const frame of [this.listener, this.blocker, this.display])
			frame.SetFrameStrata("PARENT");
		for (const name of [
			"type",
			"typerelease",
			"action",
			"spell",
			"item",
			"held",
			"count",
			"capacity",
			"occupied",
			"position",
			"binding",
			"useOnKeyDown",
			"pressAndHoldAction",
		])
			this.trigger.SetAttribute(name, undefined);
		for (const slot of this.slots) {
			this.trigger.SetAttribute(`kind${slot}`, undefined);
			this.trigger.SetAttribute(`value${slot}`, undefined);
		}
		this.slots = [];
		this.trigger.RegisterForClicks("LeftButtonUp");
		for (const cooldown of this.cooldowns) cooldown.destroy();
		for (let i = 0; i < this.items.length; i++) {
			this.trigger.SetAttribute(`slot${i + 1}`, undefined);
			this.trigger.SetAttribute(`active${i + 1}`, undefined);
			this.trigger.SetAttribute(`frameref-item${i + 1}`, undefined);
			const item = this.items.at(i);
			if (!item) continue;
			item.SetAttribute("slot", undefined);
			item.SetScript("OnEnter", undefined);
			item.SetScript("OnLeave", undefined);
			item.EnableMouse(false);
			this.pool.release("SecureFrame", item);
		}
		this.display.SetAttribute("count", undefined);
		this.trigger.SetAttribute("frameref-display", undefined);
		for (const frame of [this.listener, this.blocker])
			this.pool.release("Frame", frame);
		this.pool.release("SecureFrame", this.display);
		this.pool.release("SecureRingButton", this.trigger);
	}
}
