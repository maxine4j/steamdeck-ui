import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export interface IBuiltInBags {
	disable(): void;
	restore(): void;
}

/** Retail bag integration; preserves Blizzard's state and existing bindings. */
export class BuiltInBags implements IBuiltInBags {
	private enabled = false;
	private hooked = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	disable(): void {
		if (this.enabled) return;
		this.frames.suppress([
			ContainerFrameCombinedBags,
			ContainerFrame1,
			ContainerFrame2,
			ContainerFrame3,
			ContainerFrame4,
			ContainerFrame5,
			ContainerFrame6,
		]);
		if (!this.hooked) {
			// FrameXML bindings invoke these helpers rather than always sending BAG_OPEN.
			for (const name of [
				"ToggleAllBags",
				"ToggleBackpack",
				"ToggleBag",
				"OpenAllBags",
				"CloseAllBags",
				"OpenBackpack",
				"CloseBackpack",
				"OpenBag",
				"CloseBag",
				"CloseSpecialWindows",
			]) {
				hooksecurefunc(name, () => {
					if (this.enabled) this.events.emit("BAG_VISIBILITY_CHANGED");
				});
			}
			this.hooked = true;
		}
		this.enabled = true;
	}
	restore(): void {
		this.enabled = false;
		this.frames.restore();
	}
}
