import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { setBorder } from "./border";
import { FocusArrival } from "./focus-arrival";

export interface NativeNavigationFrame extends WowFrame {
	GetTop(): number;
	GetBottom(): number;
	GetFrameLevel(): number;
}
export interface NativeNavigationScroll {
	GetTop(): number;
	GetBottom(): number;
	GetVerticalScroll(): number;
	GetVerticalScrollRange(): number;
	SetVerticalScroll(offset: number): void;
}
export interface NativeTooltipAnchor {
	GetWidth(): number;
	GetHeight(): number;
}
export interface NativeNavigationHover {
	readonly enter: (this: void) => void;
	readonly leave: (this: void) => void;
	readonly anchor?: NativeTooltipAnchor;
}
type FocusOutline = WowFrame & {
	SetFrameLevel(level: number): void;
	EnableMouse(enabled: boolean): void;
};
export class NativeNavigation {
	private outline?: FocusOutline;
	private arrival?: FocusArrival;
	private leaveHovered?: (this: void) => void;
	private tooltipAnchor?: {
		owner: NativeNavigationFrame;
		region: NativeTooltipAnchor;
	};
	private tooltipHooked = false;
	constructor(private readonly pool: IFramePoolManager) {}
	navigation(
		frame: NativeNavigationFrame,
		scroll: NativeNavigationScroll | undefined,
		navId: string,
		onInteract: () => void,
		hover?: NativeNavigationHover,
	): INavigable {
		const leave = () => {
			if (this.leaveHovered !== hover?.leave) return;
			this.tooltipAnchor = undefined;
			this.leaveHovered?.();
			this.leaveHovered = undefined;
		};
		return {
			navId,
			onInteract: () => onInteract(),
			onFocus: (refresh) => {
				if (scroll) {
					const delta =
						frame.GetTop() > scroll.GetTop()
							? scroll.GetTop() - frame.GetTop()
							: Math.max(0, scroll.GetBottom() - frame.GetBottom());
					scroll.SetVerticalScroll(
						Math.max(
							0,
							Math.min(
								scroll.GetVerticalScrollRange(),
								scroll.GetVerticalScroll() + delta,
							),
						),
					);
				}
				if (!this.outline) {
					this.outline = this.pool.acquire("Frame") as FocusOutline;
					const outline = this.outline;
					this.arrival = new FocusArrival(this.pool, outline, (outset) =>
						setBorder(
							this.pool,
							outline,
							[1, 0.82, 0, 1],
							2,
							"native-navigation",
							outset,
						),
					);
				}
				const outline = this.outline;
				if (!outline) return;
				outline.SetParent(frame);
				outline.ClearAllPoints();
				outline.SetPoint("TOPLEFT", frame, "TOPLEFT", 0, 0);
				outline.SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", 0, 0);
				outline.SetFrameStrata("DIALOG");
				outline.SetFrameLevel(frame.GetFrameLevel() + 10);
				outline.EnableMouse(false);
				outline.Show();
				this.arrival?.focus(refresh);
				if (hover) {
					this.tooltipAnchor = undefined;
					this.leaveHovered?.();
					this.leaveHovered = hover.leave;
					if (hover.anchor) {
						this.tooltipAnchor = { owner: frame, region: hover.anchor };
						if (!this.tooltipHooked) {
							this.tooltipHooked = true;
							const hook = hooksecurefunc as unknown as (
								this: void,
								target: unknown,
								method: string,
								callback: (this: void) => void,
							) => void;
							hook(GameTooltip, "SetOwner", () => this.positionTooltip());
						}
					}
					hover.enter();
					this.positionTooltip();
				}
			},
			onBlur: () => {
				leave();
				this.arrival?.stop();
				this.outline?.Hide();
			},
		};
	}
	private positionTooltip(): void {
		const anchor = this.tooltipAnchor;
		if (!anchor) return;
		const tooltip = GameTooltip as unknown as {
			GetOwner(): WowFrame | undefined;
			SetAnchorType(type: string): void;
			ClearAllPoints(): void;
			SetPoint(
				point: string,
				relative: NativeTooltipAnchor,
				relativePoint: string,
				x: number,
				y: number,
			): void;
		};
		if (tooltip.GetOwner() !== anchor.owner) return;
		tooltip.SetAnchorType("ANCHOR_NONE");
		tooltip.ClearAllPoints();
		tooltip.SetPoint("TOPLEFT", anchor.region, "TOPRIGHT", 8, 0);
	}
	release(): void {
		this.tooltipAnchor = undefined;
		this.leaveHovered?.();
		this.leaveHovered = undefined;
		this.arrival?.destroy();
		this.arrival = undefined;
		if (this.outline) {
			this.outline.SetFrameLevel(0);
			this.pool.release("Frame", this.outline);
		}
		this.outline = undefined;
	}
}
