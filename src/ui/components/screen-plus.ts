import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

type MarkerFrame = WowFrame & {
	SetFrameStrata(strata: "BACKGROUND" | "PARENT"): void;
	SetFrameLevel(level: number): void;
	EnableMouse(enabled: boolean): void;
	SetScript(
		script: "OnUpdate",
		handler?: (this: void, frame: WowFrame, elapsed: number) => void,
	): void;
};

export class ScreenPlus {
	private frame?: MarkerFrame;
	constructor(private readonly pool: IFramePoolManager) {}
	show(
		size: number,
		color: readonly [number, number, number],
		position: () => number,
	): void {
		if (this.frame) return;
		const frame = this.pool.acquire("Frame") as MarkerFrame;
		this.frame = frame;
		frame.SetParent(UIParent);
		frame.SetSize(size, size);
		frame.SetFrameStrata("BACKGROUND");
		frame.SetFrameLevel(0);
		frame.EnableMouse(false);
		for (const [key, width, height] of [
			["horizontal", size, 2],
			["vertical", 2, size],
		] as const) {
			const bar = this.pool.getDecoration(frame, `screen-plus-${key}`);
			bar.ClearAllPoints();
			bar.SetPoint("CENTER", frame, "CENTER", 0, 0);
			bar.SetWidth(width);
			bar.SetHeight(height);
			const [red, green, blue] = color;
			bar.SetColorTexture(red, green, blue, 1);
		}
		let lastY: number | undefined;
		const move = () => {
			const parent = UIParent as WowFrame & { GetHeight(): number };
			const y = parent.GetHeight() * position();
			if (y === lastY) return;
			lastY = y;
			frame.ClearAllPoints();
			frame.SetPoint("CENTER", UIParent, "BOTTOM", 0, y);
		};
		move();
		let elapsed = 0;
		frame.SetScript("OnUpdate", (_, delta) => {
			elapsed += delta;
			if (elapsed < 0.1) return;
			elapsed = 0;
			move();
		});
		frame.Show();
	}
	destroy(): void {
		if (!this.frame) return;
		this.frame.SetScript("OnUpdate", undefined);
		this.frame.SetFrameStrata("PARENT");
		this.frame.SetFrameLevel(0);
		this.pool.release("Frame", this.frame);
		this.frame = undefined;
	}
}
