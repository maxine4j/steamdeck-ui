import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NavDirection } from "../navigation/types";

export interface CursorSurface extends WowFrame {
	SetFrameStrata(strata: string): void;
	GetLeft(): number;
	GetTop(): number;
	GetWidth(): number;
	GetHeight(): number;
	GetEffectiveScale(): number;
	GetFrameLevel(): number;
}
type CursorOverlay = WowFrame & {
	SetFrameLevel(level: number): void;
	EnableMouse(enabled: boolean): void;
};

/** A pooled crosshair positioned in viewport coordinates. */
export class NativeCursor {
	private x = 0.5;
	private y = 0.5;
	private surface?: CursorSurface;
	private overlay?: CursorOverlay;
	constructor(private readonly pool: IFramePoolManager) {}
	show(surface: CursorSurface): void {
		this.surface = surface;
		if (!this.overlay)
			this.overlay = this.pool.acquire("Frame") as CursorOverlay;
		const overlay = this.overlay;
		if (!overlay) return;
		overlay.SetParent(surface);
		overlay.ClearAllPoints();
		overlay.SetPoint("TOPLEFT", surface, "TOPLEFT", 0, 0);
		overlay.SetPoint("BOTTOMRIGHT", surface, "BOTTOMRIGHT", 0, 0);
		overlay.SetFrameStrata("DIALOG");
		overlay.SetFrameLevel(surface.GetFrameLevel() + 100);
		overlay.EnableMouse(false);
		this.render();
		overlay.Show();
	}
	hide(): void {
		this.overlay?.Hide();
	}
	move(direction: NavDirection): void {
		if (direction === "left" || direction === "right")
			this.x = Math.max(
				0,
				Math.min(1, this.x + (direction === "left" ? -0.01 : 0.01)),
			);
		else
			this.y = Math.max(
				0,
				Math.min(1, this.y + (direction === "up" ? -0.01 : 0.01)),
			);
		this.render();
	}
	private render(): void {
		const overlay = this.overlay,
			surface = this.surface;
		if (!overlay || !surface) return;
		const horizontal = this.pool.getDecoration(overlay, "cursor-horizontal");
		const vertical = this.pool.getDecoration(overlay, "cursor-vertical");
		horizontal.ClearAllPoints();
		horizontal.SetPoint(
			"LEFT",
			overlay,
			"TOPLEFT",
			0,
			-this.y * surface.GetHeight(),
		);
		horizontal.SetPoint(
			"RIGHT",
			overlay,
			"TOPRIGHT",
			0,
			-this.y * surface.GetHeight(),
		);
		horizontal.SetHeight(2);
		vertical.ClearAllPoints();
		vertical.SetPoint(
			"TOP",
			overlay,
			"TOPLEFT",
			this.x * surface.GetWidth(),
			0,
		);
		vertical.SetPoint(
			"BOTTOM",
			overlay,
			"BOTTOMLEFT",
			this.x * surface.GetWidth(),
			0,
		);
		vertical.SetWidth(2);
		horizontal.SetColorTexture(1, 0.82, 0, 0.85);
		vertical.SetColorTexture(1, 0.82, 0, 0.85);
	}
	position(surface: CursorSurface): readonly [number, number] {
		return [
			surface.GetLeft() + this.x * surface.GetWidth(),
			surface.GetTop() - this.y * surface.GetHeight(),
		];
	}
	contains(surface: CursorSurface, target: CursorSurface): boolean {
		const [x, y] = this.position(surface);
		const scale = target.GetEffectiveScale() / surface.GetEffectiveScale();
		const left = target.GetLeft() * scale,
			top = target.GetTop() * scale;
		return (
			x >= left &&
			x <= left + target.GetWidth() * scale &&
			y <= top &&
			y >= top - target.GetHeight() * scale
		);
	}
	release(): void {
		if (this.overlay) {
			this.overlay.SetFrameLevel(0);
			this.pool.release("Frame", this.overlay);
		}
		this.overlay = undefined;
		this.surface = undefined;
		this.x = this.y = 0.5;
	}
}
