import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

type AnimationTimer = WowFrame & {
	SetScript(
		script: "OnUpdate",
		callback?: (this: void, frame: WowFrame, elapsed: number) => void,
	): void;
};

/** Briefly expands an outline around its center without scaling its control. */
export class FocusArrival {
	private timer?: AnimationTimer;
	private focused = false;
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly owner: WowFrame,
		private readonly draw: (outset: number) => void,
	) {}
	focus(refresh = false): void {
		if (this.focused) return;
		this.focused = true;
		if (refresh) {
			this.draw(0);
			return;
		}
		if (!this.timer) {
			this.timer = this.pool.acquire("FocusTimer") as AnimationTimer;
			this.timer.SetParent(this.owner);
			this.timer.SetSize(1, 1);
			this.timer.SetPoint("CENTER", this.owner, "CENTER", 0, 0);
		}
		const timer = this.timer;
		let elapsed = 0;
		this.draw(6);
		timer.SetScript("OnUpdate", (_frame, delta) => {
			elapsed += delta;
			const remaining = Math.max(0, 1 - elapsed / 0.18);
			this.draw(6 * remaining * remaining);
			if (remaining === 0) {
				this.releaseTimer();
			}
		});
		timer.Show();
	}
	stop(): void {
		this.focused = false;
		this.releaseTimer();
		this.draw(0);
	}
	private releaseTimer(): void {
		if (this.timer) {
			this.timer.SetScript("OnUpdate", undefined);
			this.pool.release("FocusTimer", this.timer);
		}
		this.timer = undefined;
	}
	destroy(): void {
		this.stop();
	}
}
