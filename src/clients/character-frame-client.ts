import type { ApplicationEvent, IEventBus } from "../events/types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";

export interface ICharacterFrameClient {
	enable(tab: string, event: ApplicationEvent): void;
	disable(tab: string): void;
	isOpen(tab?: string): boolean;
	open(tab: string): void;
	close(): void;
}

/** One owner for the native window: reparenting fires child show/hide scripts. */
export class CharacterFrameClient implements ICharacterFrameClient {
	private readonly tabs = new Map<
		string,
		{ event: ApplicationEvent; open?: boolean }
	>();
	private hooked = false;
	private syncing = false;
	private suppressed = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	private readonly sync = () => {
		if (this.syncing) return;
		this.syncing = true;
		try {
			const shown = CharacterFrame.IsShown();
			const active = CharacterFrame.activeSubframe;
			const suppress = shown && this.tabs.has(active ?? "");
			if (suppress !== this.suppressed) {
				// Set state before mutation: SetParent can immediately reenter hooks.
				this.suppressed = suppress;
				if (suppress) this.frames.suppress([CharacterFrame]);
				else this.frames.restore();
			}
			for (const [tab, state] of this.tabs) {
				const open = shown && tab === active;
				if (state.open === open) continue;
				state.open = open;
				this.events.emit(state.event);
			}
		} finally {
			this.syncing = false;
		}
	};
	enable(tab: string, event: ApplicationEvent): void {
		if (this.tabs.has(tab)) return;
		this.tabs.set(tab, { event });
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
		this.sync();
	}
	disable(tab: string): void {
		this.tabs.delete(tab);
		this.sync();
	}
	isOpen(tab?: string): boolean {
		return (
			CharacterFrame.IsShown() &&
			(tab === undefined || CharacterFrame.activeSubframe === tab)
		);
	}
	open(tab: string): void {
		ToggleCharacter(tab, true);
	}
	close(): void {
		if (this.isOpen()) HideUIPanel(CharacterFrame);
	}
}
