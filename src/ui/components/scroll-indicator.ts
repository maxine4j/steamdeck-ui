import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

export interface IndicatorScroll extends WowFrame {
	SetFrameStrata(strata: string): void;
	GetHeight(): number;
	GetFrameLevel(): number;
	HookScript(script: string, callback: (this: void) => void): void;
}

export function drawScrollIndicator(
	thumb: WowTexture,
	scroll: WowFrame & { GetHeight(): number },
): void {
	const range = scroll.GetVerticalScrollRange();
	const viewport = scroll.GetHeight();
	const track = Math.max(0, viewport - 8);
	const height = Math.min(
		track,
		Math.max(24, (track * viewport) / Math.max(1, viewport + range)),
	);
	const progress =
		range > 0
			? Math.max(0, Math.min(1, scroll.GetVerticalScroll() / range))
			: 0;
	thumb.ClearAllPoints();
	thumb.SetPoint(
		"TOPRIGHT",
		scroll,
		"TOPRIGHT",
		-3,
		-4 - progress * (track - height),
	);
	thumb.SetWidth(3);
	thumb.SetHeight(height);
	thumb.SetColorTexture(1, 1, 1, range > 0 && track > 0 ? 0.35 : 0);
}

/** Adds the shared minimal indicator without replacing native scrolling scripts. */
export class NativeScrollIndicator {
	private frame?: WowFrame & {
		SetFrameLevel(level: number): void;
		EnableMouse(enabled: boolean): void;
	};
	private thumb?: WowTexture;
	private scroll?: IndicatorScroll;
	private readonly hooked = new Set<IndicatorScroll>();
	constructor(private readonly pool: IFramePoolManager) {}
	bind(scroll: IndicatorScroll): void {
		this.scroll = scroll;
		this.frame ??= this.pool.acquire("Frame") as NonNullable<
			NativeScrollIndicator["frame"]
		>;
		const frame = this.frame;
		frame.SetParent(scroll);
		frame.ClearAllPoints();
		frame.SetPoint("TOPLEFT", scroll, "TOPLEFT", 0, 0);
		frame.SetPoint("BOTTOMRIGHT", scroll, "BOTTOMRIGHT", 0, 0);
		frame.SetFrameStrata("DIALOG");
		frame.SetFrameLevel(scroll.GetFrameLevel() + 10);
		frame.EnableMouse(false);
		this.thumb = this.pool.getDecoration(frame, "scroll-indicator");
		if (!this.hooked.has(scroll)) {
			this.hooked.add(scroll);
			for (const script of [
				"OnVerticalScroll",
				"OnScrollRangeChanged",
				"OnSizeChanged",
			])
				scroll.HookScript(script, () => {
					if (this.scroll === scroll && this.thumb)
						drawScrollIndicator(this.thumb, scroll);
				});
		}
		drawScrollIndicator(this.thumb, scroll);
		frame.Show();
	}
	release(): void {
		this.scroll = undefined;
		this.thumb = undefined;
		if (this.frame) {
			this.frame.SetFrameLevel(0);
			this.pool.release("Frame", this.frame);
			this.frame = undefined;
		}
	}
}
