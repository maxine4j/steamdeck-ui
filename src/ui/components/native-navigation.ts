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
type FocusOutline = WowFrame & {
	SetFrameLevel(level: number): void;
	EnableMouse(enabled: boolean): void;
};
export class NativeNavigation {
	private outline?: FocusOutline;
	private arrival?: FocusArrival;
	constructor(private readonly pool: IFramePoolManager) {}
	navigation(
		frame: NativeNavigationFrame,
		scroll: NativeNavigationScroll,
		navId: string,
		onInteract: () => void,
	): INavigable {
		return {
			navId,
			onInteract: () => onInteract(),
			onFocus: (refresh) => {
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
			},
			onBlur: () => {
				this.arrival?.stop();
				this.outline?.Hide();
			},
		};
	}
	release(): void {
		this.arrival?.destroy();
		this.arrival = undefined;
		if (this.outline) {
			this.outline.SetFrameLevel(0);
			this.pool.release("Frame", this.outline);
		}
		this.outline = undefined;
	}
}
