import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export interface IBuiltInPaperDoll {
	disable(): void;
	restore(): void;
}
/** Preserve Blizzard's logical shown state, UIPanel manager and binding actions. */
export class BuiltInPaperDoll implements IBuiltInPaperDoll {
	private enabled = false;
	private hooked = false;
	private readonly sync = () => {
		if (!this.enabled) return;
		if (
			CharacterFrame.IsShown() &&
			CharacterFrame.activeSubframe === "PaperDollFrame"
		)
			this.frames.suppress([CharacterFrame]);
		else this.frames.restore();
		this.events.emit("CHARACTER_VISIBILITY_CHANGED");
	};
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	disable(): void {
		if (this.enabled) return;
		if (!this.hooked) {
			for (const name of [
				"ToggleCharacter",
				"ShowUIPanel",
				"HideUIPanel",
				"CloseSpecialWindows",
			])
				hooksecurefunc(name, () => this.sync());
			for (const method of ["Show", "Hide", "ShowSubFrame"])
				hooksecurefunc(CharacterFrame, method, () => this.sync());
			this.hooked = true;
		}
		this.enabled = true;
		this.sync();
	}
	restore(): void {
		this.enabled = false;
		this.frames.restore();
	}
}
