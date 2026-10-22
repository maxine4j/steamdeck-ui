import type { SkyridingState } from "../../clients/skyriding-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { SkyridingView } from "./skyriding-module";

export class SkyridingBar implements SkyridingView {
	private initialized = false;
	private readonly track: Frame;
	private readonly cruise: Frame;
	private readonly boost: Frame;
	private readonly marker: Frame;
	constructor(pool: IFramePoolManager) {
		this.track = new Frame("skyriding-track", pool);
		this.cruise = new Frame("skyriding-cruise", pool);
		this.boost = new Frame("skyriding-boost", pool);
		this.marker = new Frame("skyriding-marker", pool);
	}
	render(state: SkyridingState): void {
		if (!this.initialized) {
			this.track.layout(304, 14, "BOTTOM", undefined, 0, 168);
			this.track.setColor(0.04, 0.06, 0.08, 0.95);
			this.track.setBorder([0.5, 0.46, 0.36, 1], 1);
			for (const child of [this.cruise, this.boost, this.marker])
				child.setParent(this.track);
			this.cruise.setColor(0.1, 0.65, 0.85);
			this.boost.setColor(0.7, 0.35, 1);
			this.marker.setColor(1, 0.82, 0.25);
			this.initialized = true;
		}
		const maximum = Math.max(state.maximumSpeed, state.speed);
		const cruiseWidth =
			(300 * Math.min(state.speed, state.cruisingSpeed)) / maximum;
		const markerX = (300 * state.cruisingSpeed) / maximum;
		const boostWidth =
			(300 * Math.max(0, state.speed - state.cruisingSpeed)) / maximum;
		this.segment(this.cruise, cruiseWidth, 2);
		this.segment(this.boost, boostWidth, 2 + markerX);
		this.marker.layout(2, 18, "TOPLEFT", this.track, 1 + markerX, 2);
		this.marker.show();
		this.track.setLabel(
			"speed",
			`${Math.floor(state.speed)} yd/s`,
			"TOP",
			0,
			18,
			12,
		);
		this.track.show();
	}
	private segment(frame: Frame, width: number, x: number): void {
		if (width <= 0) {
			frame.hide();
			return;
		}
		frame.layout(width, 10, "TOPLEFT", this.track, x, -2);
		frame.show();
	}
	hide(): void {
		this.track.hide();
	}
	destroy(): void {
		for (const frame of [this.marker, this.boost, this.cruise, this.track])
			frame.destroy();
		this.initialized = false;
	}
}
