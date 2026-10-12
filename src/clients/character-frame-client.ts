import type { IEventBus } from "../events/types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";

type CharacterVisibilityEvent =
	| "CHARACTER_VISIBILITY_CHANGED"
	| "REPUTATION_VISIBILITY_CHANGED"
	| "CURRENCY_VISIBILITY_CHANGED";
export interface ICharacterFrameClient {
	enable(tab: string, event: CharacterVisibilityEvent, group?: string): void;
	disable(tab: string): void;
	isOpen(tab?: string): boolean;
	open(tab: string): void;
	close(tab?: string): void;
}

/** One owner for the native window: reparenting fires child show/hide scripts. */
export class CharacterFrameClient implements ICharacterFrameClient {
	private readonly tabs = new Map<
		string,
		{ event: CharacterVisibilityEvent; group: string; open?: boolean }
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
			const activeGroup = this.tabs.get(active ?? "")?.group;
			const suppress = shown && this.tabs.has(active ?? "");
			if (suppress !== this.suppressed) {
				// Set state before mutation: SetParent can immediately reenter hooks.
				this.suppressed = suppress;
				if (suppress) this.frames.suppress([CharacterFrame]);
				else this.frames.restore();
			}
			for (const [tab, state] of this.tabs) {
				const open =
					shown &&
					activeGroup !== undefined &&
					(state.group === activeGroup
						? tab === active
						: (state.open ?? false));
				if (state.open === open) continue;
				state.open = open;
				this.events.emit(state.event);
			}
		} finally {
			this.syncing = false;
		}
	};
	enable(
		tab: string,
		event: CharacterVisibilityEvent,
		group = "character",
	): void {
		if (this.tabs.has(tab)) return;
		this.tabs.set(tab, { event, group });
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
		if (tab !== undefined && this.tabs.has(tab))
			return this.tabs.get(tab)?.open === true;
		return (
			CharacterFrame.IsShown() &&
			(tab === undefined || CharacterFrame.activeSubframe === tab)
		);
	}
	open(tab: string): void {
		ToggleCharacter(tab, true);
	}
	close(tab?: string): void {
		if (tab === undefined) {
			if (this.isOpen()) HideUIPanel(CharacterFrame);
			return;
		}
		const group = this.tabs.get(tab)?.group;
		if (group === undefined) return;
		// A dock owns its logical selection; the native frame is just an input source.
		this.syncing = true;
		try {
			for (const state of this.tabs.values()) {
				if (state.group !== group || !state.open) continue;
				state.open = false;
				this.events.emit(state.event);
			}
			if (this.tabs.get(CharacterFrame.activeSubframe ?? "")?.group === group) {
				let remaining: string | undefined;
				for (const [name, state] of this.tabs)
					if (state.open) {
						remaining = name;
						break;
					}
				if (remaining !== undefined) ToggleCharacter(remaining, true);
				else if (CharacterFrame.IsShown()) HideUIPanel(CharacterFrame);
			}
		} finally {
			this.syncing = false;
		}
		this.sync();
	}
}
