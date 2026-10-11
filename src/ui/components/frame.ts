import type { WowFontString, WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { IUIComponent } from "./types";
export class Frame implements IUIComponent {
	private native?: WowFrame;
	private texture?: WowTexture;
	private readonly labels = new Map<string, WowFontString>();
	constructor(
		public readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly frameType: "Frame" | "Button" | "ScrollFrame" = "Frame",
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
	dock(position: "left" | "right" | "fullscreen", width: number): void {
		const native = this.acquire();
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
	}
	setColor(red: number, green: number, blue: number, alpha = 1): void {
		this.acquire();
		this.texture?.SetColorTexture(red, green, blue, alpha);
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
	onClick(callback: (this: void) => void): void {
		if (this.frameType !== "Button")
			throw new Error("Click handlers require a button");
		this.acquire().SetScript("OnClick", callback);
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
		this.texture?.SetColorTexture(0, 0, 0, 0);
		for (const label of this.labels.values()) label.SetText("");
		this.labels.clear();
		if (this.frameType === "Button")
			this.native.SetScript("OnClick", undefined);
		if (this.frameType === "ScrollFrame") {
			this.native.SetScript("OnMouseWheel", undefined);
			this.native.EnableMouseWheel(false);
			this.native.SetVerticalScroll(0);
			this.native.SetScrollChild(undefined);
		}
		this.pool.release(this.frameType, this.native);
		this.native = undefined;
		this.texture = undefined;
	}
}
