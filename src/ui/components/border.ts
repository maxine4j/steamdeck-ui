import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

export type BorderColor = readonly [number, number, number, number];

/** Inset edges keep adjacent controls and cooldowns from covering the border. */
export function setBorder(
	pool: IFramePoolManager,
	frame: WowFrame,
	color: BorderColor,
	width = 2,
): void {
	for (const edge of ["TOP", "BOTTOM", "LEFT", "RIGHT"]) {
		const texture = pool.getDecoration(frame, `border-${edge}`);
		texture.ClearAllPoints();
		if (edge === "TOP" || edge === "BOTTOM") {
			texture.SetPoint(`${edge}LEFT`, frame, `${edge}LEFT`, 0, 0);
			texture.SetPoint(`${edge}RIGHT`, frame, `${edge}RIGHT`, 0, 0);
			texture.SetHeight(width);
		} else {
			texture.SetPoint(`TOP${edge}`, frame, `TOP${edge}`, 0, -width);
			texture.SetPoint(`BOTTOM${edge}`, frame, `BOTTOM${edge}`, 0, width);
			texture.SetWidth(width);
		}
		texture.SetColorTexture(...color);
	}
}
