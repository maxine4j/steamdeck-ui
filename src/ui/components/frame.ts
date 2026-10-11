import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { IUIComponent } from "./types";
export class Frame implements IUIComponent {
	private native?: WowFrame;
	private texture?: WowTexture;
	constructor(
		public readonly id: string,
		private readonly pool: IFramePoolManager,
	) {}
	private acquire(): WowFrame {
		if (!this.native) {
			this.native = this.pool.acquire("Frame");
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
	setIcon(iconFileId: number): void {
		this.acquire();
		this.texture?.SetTexture(iconFileId);
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
		this.pool.release("Frame", this.native);
		this.native = undefined;
		this.texture = undefined;
	}
}
