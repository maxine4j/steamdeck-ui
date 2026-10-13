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
	SetScript(
		script: "OnUpdate",
		handler?: (this: void, frame: WowFrame, elapsed: number) => void,
	): void;
	SetFrameLevel(level: number): void;
	EnableMouse(enabled: boolean): void;
};
export interface CursorTarget extends CursorSurface {
	IsMouseOver(): boolean;
	OnMouseEnter?(): void;
	OnMouseLeave?(): void;
}
type CursorTooltip = WowFrame & {
	GetOwner(): WowFrame | undefined;
	SetAnchorType(type: string): void;
};

/** A pooled crosshair positioned in viewport coordinates. */
export class NativeCursor {
	private x = 0.5;
	private y = 0.5;
	private surface?: CursorSurface;
	private overlay?: CursorOverlay;
	private readonly held = new Set<NavDirection>();
	private hovered?: CursorTarget;
	private readonly mouseQueries = new Map<
		CursorTarget,
		CursorTarget["IsMouseOver"]
	>();
	constructor(private readonly pool: IFramePoolManager) {}
	show(surface: CursorSurface, onUpdate?: () => void): void {
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
		overlay.SetScript("OnUpdate", (_frame, elapsed) => {
			const dx =
				(this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
			const dy =
				(this.held.has("down") ? 1 : 0) - (this.held.has("up") ? 1 : 0);
			const distance =
				(240 * Math.min(elapsed, 0.1)) /
				(dx !== 0 && dy !== 0 ? Math.sqrt(2) : 1);
			this.x = Math.max(
				0,
				Math.min(1, this.x + (dx * distance) / Math.max(1, surface.GetWidth())),
			);
			this.y = Math.max(
				0,
				Math.min(
					1,
					this.y + (dy * distance) / Math.max(1, surface.GetHeight()),
				),
			);
			if (dx !== 0 || dy !== 0) this.render();
			onUpdate?.();
		});
		this.render();
		overlay.Show();
	}
	hide(): void {
		const previous = this.hovered;
		this.hover();
		const tooltip = GameTooltip as unknown as CursorTooltip;
		if (
			tooltip.GetOwner() !== previous &&
			this.mouseQueries.has(tooltip.GetOwner() as CursorTarget)
		)
			tooltip.Hide();
		for (const [target, query] of this.mouseQueries) target.IsMouseOver = query;
		this.mouseQueries.clear();
		this.held.clear();
		this.overlay?.SetScript("OnUpdate", undefined);
		this.overlay?.Hide();
	}
	move(direction: NavDirection, pressed: boolean): void {
		if (pressed) this.held.add(direction);
		else this.held.delete(direction);
	}
	trackMouseOver(surface: CursorSurface, target: CursorTarget): void {
		if (this.mouseQueries.has(target)) return;
		this.mouseQueries.set(target, target.IsMouseOver);
		target.IsMouseOver = () => this.contains(surface, target);
	}
	hover(target?: CursorTarget): void {
		const tooltip = GameTooltip as unknown as CursorTooltip;
		if (this.hovered !== target) {
			const previous = this.hovered;
			previous?.OnMouseLeave?.();
			if (previous && tooltip.GetOwner() === previous) tooltip.Hide();
			this.hovered = target;
			target?.OnMouseEnter?.();
		}
		if (
			this.overlay &&
			this.surface &&
			this.mouseQueries.has(tooltip.GetOwner() as CursorTarget)
		) {
			tooltip.SetAnchorType("ANCHOR_NONE");
			tooltip.ClearAllPoints();
			tooltip.SetPoint(
				"TOPLEFT",
				this.overlay,
				"TOPLEFT",
				this.x * this.surface.GetWidth() + 16,
				-this.y * this.surface.GetHeight() - 16,
			);
		}
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
		this.hide();
		if (this.overlay) {
			this.overlay.SetFrameLevel(0);
			this.pool.release("Frame", this.overlay);
		}
		this.overlay = undefined;
		this.surface = undefined;
		this.x = this.y = 0.5;
	}
}
