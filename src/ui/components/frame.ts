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
	): void {
		const native = this.acquire();
		native.ClearAllPoints();
		native.SetSize(width, height);
		native.SetPoint(point, parent?.acquire(), point, 0, 0);
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
