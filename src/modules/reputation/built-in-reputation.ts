import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";
export interface IBuiltInReputation {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
	isCharacterOpen(): boolean;
}
/** Shares suppression with Paper Doll so native subframe transitions restore one parent. */
export class BuiltInReputation implements IBuiltInReputation {
	private enabled = false;
	private hooked = false;
	private readonly sync = () => {
		if (!this.enabled) return;
		if (
			this.isCharacterOpen() &&
			(this.isOpen() || CharacterFrame.activeSubframe === "PaperDollFrame")
		)
			this.frames.suppress([CharacterFrame]);
		else this.frames.restore();
		this.events.emit("REPUTATION_VISIBILITY_CHANGED");
	};
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isCharacterOpen(): boolean {
		return CharacterFrame.IsShown();
	}
	isOpen(): boolean {
		return (
			this.isCharacterOpen() &&
			CharacterFrame.activeSubframe === "ReputationFrame"
		);
	}
	close(): void {
		if (this.isCharacterOpen()) HideUIPanel(CharacterFrame);
	}
	open(): void {
		ToggleCharacter("ReputationFrame", true);
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
