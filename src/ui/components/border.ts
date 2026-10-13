import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

export type BorderColor = readonly [number, number, number, number];

/** Inset edges keep adjacent controls and cooldowns from covering the border. */
export function setBorder(
	pool: IFramePoolManager,
	frame: WowFrame,
	color: BorderColor,
	width = 2,
	decorationKey = "border",
	outset = 0,
): void {
	for (const edge of ["TOP", "BOTTOM", "LEFT", "RIGHT"]) {
		const negativeOutset = outset === 0 ? 0 : -outset;
		const texture = pool.getDecoration(frame, `${decorationKey}-${edge}`);
		texture.ClearAllPoints();
		if (edge === "TOP" || edge === "BOTTOM") {
			const y = edge === "TOP" ? outset : negativeOutset;
			texture.SetPoint(`${edge}LEFT`, frame, `${edge}LEFT`, negativeOutset, y);
			texture.SetPoint(`${edge}RIGHT`, frame, `${edge}RIGHT`, outset, y);
			texture.SetHeight(width);
		} else {
			const x = edge === "LEFT" ? negativeOutset : outset;
			texture.SetPoint(`TOP${edge}`, frame, `TOP${edge}`, x, outset - width);
			texture.SetPoint(
				`BOTTOM${edge}`,
				frame,
				`BOTTOM${edge}`,
				x,
				width - outset,
			);
			texture.SetWidth(width);
		}
		texture.SetColorTexture(...color);
	}
}
