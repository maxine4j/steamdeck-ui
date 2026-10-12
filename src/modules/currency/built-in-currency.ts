import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export interface IBuiltInCurrency {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
/** Shares CharacterFrame suppression with the other replacement character tabs. */
export class BuiltInCurrency implements IBuiltInCurrency {
	private enabled = false;
	private hooked = false;
	private readonly sync = () => {
		if (!this.enabled) return;
		if (
			CharacterFrame.IsShown() &&
			["TokenFrame", "ReputationFrame", "PaperDollFrame"].includes(
				CharacterFrame.activeSubframe ?? "",
			)
		)
			this.frames.suppress([CharacterFrame]);
		else this.frames.restore();
		this.events.emit("CURRENCY_VISIBILITY_CHANGED");
	};
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isOpen(): boolean {
		return (
			CharacterFrame.IsShown() && CharacterFrame.activeSubframe === "TokenFrame"
		);
	}
	open(): void {
		ToggleCharacter("TokenFrame", true);
	}
	close(): void {
		if (CharacterFrame.IsShown()) HideUIPanel(CharacterFrame);
	}
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
