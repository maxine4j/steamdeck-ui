import type { WowFontString, WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { type BorderColor, setBorder } from "./border";
import type { IUIComponent } from "./types";
export class Frame implements IUIComponent {
	private native?: WowFrame;
	private docked = false;
	private texture?: WowTexture;
	private readonly labels = new Map<string, WowFontString>();
	constructor(
		public readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly frameType:
			| "Frame"
			| "Button"
			| "SecureButton"
			| "EditBox"
			| "ScrollFrame"
			| "PlayerModel" = "Frame",
	) {}
	private acquire(): WowFrame {
		if (!this.native) {
			this.native = this.pool.acquire(this.frameType);
			this.texture = this.pool.getBackground(this.native);
		}
		return this.native;
	}
	layout(
		width: number,
		height: number,
		point = "CENTER",
		parent?: Frame,
		x = 0,
		y = 0,
	): void {
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetSize(width, height);
		native.SetPoint(point, parent?.acquire(), point, x, y);
	}
	layoutVerticallyCentered(width: number, height: number, parent: Frame): void {
		const native = parent.acquire() as WowFrame & { GetHeight(): number };
		const offset = Math.max(0, (native.GetHeight() - height) / 2);
		this.layout(width, height, "TOPLEFT", parent, 0, -offset);
	}
	onSizeChanged(callback?: (this: void) => void): void {
		const native = this.acquire() as WowFrame & {
			SetScript(script: "OnSizeChanged", handler?: (this: void) => void): void;
		};
		native.SetScript("OnSizeChanged", callback);
	}
	dock(position: "left" | "right" | "fullscreen", width: number): void {
		const native = this.acquire();
		native.SetFrameStrata("DIALOG");
		this.docked = true;
		native.ClearAllPoints();
		native.SetSize(position === "fullscreen" ? 0 : width, 0);
		const edge = position === "right" ? "RIGHT" : "LEFT";
		native.SetPoint(`TOP${edge}`, undefined, `TOP${edge}`, 0, 0);
		native.SetPoint(
			position === "fullscreen" ? "BOTTOMRIGHT" : `BOTTOM${edge}`,
			undefined,
			position === "fullscreen" ? "BOTTOMRIGHT" : `BOTTOM${edge}`,
			0,
			0,
		);
	}
	fill(parent: Frame): void {
		this.setParent(parent);
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetPoint("TOPLEFT", parent.acquire(), "TOPLEFT", 0, 0);
		native.SetPoint("BOTTOMRIGHT", parent.acquire(), "BOTTOMRIGHT", 0, 0);
	}
	inset(
		parent: Frame,
		left: number,
		top: number,
		right: number,
		bottom: number,
	): void {
		this.setParent(parent);
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetPoint("TOPLEFT", parent.acquire(), "TOPLEFT", left, -top);
		native.SetPoint(
			"BOTTOMRIGHT",
			parent.acquire(),
			"BOTTOMRIGHT",
			-right,
			bottom,
		);
	}
	setScrollContent(content: Frame): void {
		const native = this.acquire();
		native.SetScrollChild(content.acquire());
		native.EnableMouseWheel(true);
		native.SetScript("OnMouseWheel", (_frame, delta) => {
			native.SetVerticalScroll(
				Math.max(
					0,
					Math.min(
						native.GetVerticalScrollRange(),
						native.GetVerticalScroll() - delta * 46,
					),
				),
			);
		});
	}
	resetScroll(): void {
		this.native?.SetVerticalScroll(0);
	}
	clampScroll(): void {
		const native = this.acquire();
		native.SetVerticalScroll(
			Math.max(
				0,
				Math.min(native.GetVerticalScrollRange(), native.GetVerticalScroll()),
			),
		);
	}
	setIcon(iconFileId: number): void {
		this.acquire();
		this.texture?.SetTexture(iconFileId);
		this.texture?.SetTexCoord(0.07, 0.93, 0.07, 0.93);
	}
	setModelUnit(unit: string): void {
		if (this.frameType !== "PlayerModel")
			throw new Error("Model requires a PlayerModel frame");
		const model = this.acquire() as WowFrame & {
			SetUnit(unit: string): void;
			SetPortraitZoom(zoom: number): void;
			SetCamDistanceScale(scale: number): void;
			SetFacing(facing: number): void;
		};
		model.SetUnit(unit);
		model.SetPortraitZoom(0);
		model.SetCamDistanceScale(1);
		model.SetFacing(0);
	}
	setBorder(color: BorderColor, width = 2): void {
		setBorder(this.pool, this.acquire(), color, width);
	}
	setColor(red: number, green: number, blue: number, alpha = 1): void {
		this.acquire();
		this.texture?.SetColorTexture(red, green, blue, alpha);
	}
	setTooltip(text: string, hyperlink?: string): void {
		const native = this.acquire();
		native.SetScript("OnEnter", () => {
			GameTooltip.SetOwner(native, "ANCHOR_RIGHT");
			if (hyperlink) GameTooltip.SetHyperlink(hyperlink);
			else GameTooltip.SetText(text);
			GameTooltip.Show();
		});
		native.SetScript("OnLeave", () => GameTooltip.Hide());
	}
	setLabel(
		key: string,
		text: string,
		point = "CENTER",
		x = 0,
		y = 0,
		size = 14,
		width = 0,
	): void {
		const native = this.acquire();
		let label = this.labels.get(key);
		if (!label) {
			label = native.CreateFontString(undefined, "OVERLAY", "GameFontNormal");
			this.labels.set(key, label);
		}
		label.ClearAllPoints();
		label.SetPoint(point, native, point, x, y);
		label.SetFont("Fonts\\FRIZQT__.TTF", size, "OUTLINE");
		label.SetJustifyH(
			point.includes("LEFT")
				? "LEFT"
				: point.includes("RIGHT")
					? "RIGHT"
					: "CENTER",
		);
		label.SetWidth(width);
		label.SetText(text);
	}
	onClick(callback: (this: void, button: string) => void): void {
		if (this.frameType !== "Button")
			throw new Error("Click handlers require a button");
		const native = this.acquire();
		native.RegisterForClicks("LeftButtonUp", "RightButtonUp");
		native.SetScript("OnClick", (_frame, button) => callback(button));
	}
	setSpell(spell?: number): void {
		if (this.frameType !== "SecureButton")
			throw new Error("Spell requires a secure button");
		if (InCombatLockdown()) return;
		const native = this.acquire() as WowFrame & {
			SetAttribute(name: string, value?: string | number): void;
		};
		native.RegisterForClicks("AnyUp", "AnyDown");
		native.SetAttribute("type", spell ? "spell" : undefined);
		native.SetAttribute("spell", spell);
	}
	click(): void {
		(this.acquire() as WowFrame & { Click(): void }).Click();
	}
	configureInput(change?: (this: void, text: string) => void): void {
		if (this.frameType !== "EditBox")
			throw new Error("Input requires an edit box");
		const native = this.acquire() as WowFrame & {
			SetAutoFocus(value: boolean): void;
			SetFontObject(name: string): void;
			SetTextInsets(
				left: number,
				right: number,
				top: number,
				bottom: number,
			): void;
			GetText(): string;
			SetText(text: string): void;
			SetFocus(): void;
			ClearFocus(): void;
			SetScript(script: string, handler?: (this: void) => void): void;
		};
		native.SetAutoFocus(false);
		native.SetFontObject("GameFontHighlight");
		native.SetTextInsets(8, 8, 0, 0);
		native.SetScript(
			"OnTextChanged",
			change ? () => change(native.GetText()) : undefined,
		);
		native.SetScript("OnEscapePressed", () => native.ClearFocus());
		native.SetScript("OnEnterPressed", () => native.ClearFocus());
	}
	focusInput(): void {
		(this.acquire() as WowFrame & { SetFocus(): void }).SetFocus();
	}
	onDragStart(callback: (this: void) => void): void {
		if (this.frameType !== "Button")
			throw new Error("Drag handlers require a button");
		const native = this.acquire();
		native.RegisterForDrag("LeftButton");
		native.SetScript("OnDragStart", () => callback());
	}
	onReceiveDrag(callback: (this: void) => void): void {
		const native = this.acquire() as WowFrame & {
			SetScript(script: "OnReceiveDrag", handler?: (this: void) => void): void;
		};
		native.SetScript("OnReceiveDrag", callback);
	}
	setBlackBackground(): void {
		this.acquire();
		this.texture?.SetColorTexture(0, 0, 0, 1);
	}
	show(): void {
		this.acquire().Show();
	}
	hide(): void {
		this.native?.Hide();
	}
	setParent(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Frame requires a frame component parent");
		this.acquire().SetParent(parent.acquire());
	}
	destroy(): void {
		if (!this.native) return;
		if (this.frameType === "EditBox") {
			this.configureInput();
			const input = this.native as WowFrame & {
				SetText(text: string): void;
				ClearFocus(): void;
				SetScript(script: string, handler?: (this: void) => void): void;
			};
			input.SetText("");
			input.ClearFocus();
			input.SetScript("OnEscapePressed", undefined);
			input.SetScript("OnEnterPressed", undefined);
		}
		if (this.frameType === "SecureButton") this.setSpell();
		this.onSizeChanged();
		if (this.frameType === "PlayerModel")
			(this.native as WowFrame & { ClearModel(): void }).ClearModel();
		this.texture?.SetColorTexture(0, 0, 0, 0);
		for (const label of this.labels.values()) label.SetText("");
		this.labels.clear();
		this.native.SetScript("OnEnter", undefined);
		this.native.SetScript("OnLeave", undefined);
		if (this.frameType === "Button") {
			(
				this.native as WowFrame & {
					SetScript(
						script: "OnReceiveDrag",
						handler?: (this: void) => void,
					): void;
				}
			).SetScript("OnReceiveDrag", undefined);
			this.native.SetScript("OnClick", undefined);
			this.native.SetScript("OnDragStart", undefined);
			this.native.RegisterForClicks("LeftButtonUp");
			this.native.RegisterForDrag();
		}
		if (this.frameType === "ScrollFrame") {
			this.native.SetScript("OnMouseWheel", undefined);
			this.native.EnableMouseWheel(false);
			this.native.SetVerticalScroll(0);
			this.native.SetScrollChild(undefined);
		}
		if (this.docked) {
			this.native.SetFrameStrata("PARENT");
			this.docked = false;
		}
		this.pool.release(this.frameType, this.native);
		this.native = undefined;
		this.texture = undefined;
	}
}
