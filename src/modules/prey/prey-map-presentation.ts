import type { PreyTarget } from "../../clients/prey-targets-client";
import type { NativeMarkers } from "../../ui/components/native-markers";
import type { PreyMapPin } from "./wow-prey-globals";

export interface PreyMarkerTarget {
	readonly pin: PreyMapPin;
	readonly target: PreyTarget;
}
export class PreyMapPresentation {
	constructor(
		private readonly markers: Pick<NativeMarkers, "sync" | "release">,
	) {}
	sync(targets: readonly PreyMarkerTarget[]): void {
		this.markers.sync(
			targets.map(({ pin, target }) => ({
				owner: pin,
				replace: [pin.Icon, pin.IconHighlight].filter(
					(region) => region !== undefined,
				),
				atlas:
					target.difficulty === 3
						? "ui-hud-minimap-guildbanner-mythic-large"
						: target.difficulty === 2
							? "ui-hud-minimap-guildbanner-heroic-large"
							: "ui-hud-minimap-guildbanner-normal-large",
				size: 38,
				badge: target.needed
					? { atlas: "QuestNormal", size: 16, x: 22 }
					: undefined,
			})),
		);
	}
	release(): void {
		this.markers.release();
	}
}
