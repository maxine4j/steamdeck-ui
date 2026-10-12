import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export interface IBuiltInTalents {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
/** Blizzard integration stays here; the module only receives application events. */
export class BuiltInTalents implements IBuiltInTalents {
	private enabled = false;
	private hooked = false;
	private frameHooked = false;
	private full = false;
	private syncing = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isOpen(): boolean {
		const frame = PlayerSpellsFrame;
		return frame?.IsShown() === true && this.shouldReplace();
	}
	private shouldReplace(): boolean {
		const frame = PlayerSpellsFrame;
		return (
			this.enabled &&
			!this.full &&
			frame !== undefined &&
			!frame.IsInspecting() &&
			(frame.GetTab() === frame.talentTabID ||
				frame.GetTab() === frame.specTabID)
		);
	}
	private readonly sync = () => {
		if (!this.enabled || this.syncing) return;
		this.syncing = true;
		if (!PlayerSpellsFrame?.IsShown()) this.full = false;
		// Suppress before ShowUIPanel so native tree OnShow/rendering never runs for the side panel.
		if (this.shouldReplace() && PlayerSpellsFrame)
			this.frames.suppress([PlayerSpellsFrame]);
		else this.frames.restore();
		this.syncing = false;
		this.events.emit("TALENTS_VISIBILITY_CHANGED");
	};
	private readonly attach = () => {
		const frame = PlayerSpellsFrame;
		if (!this.enabled || !frame || this.frameHooked) return;
		frame.HookScript("OnShow", this.sync);
		frame.HookScript("OnHide", this.sync);
		hooksecurefunc(frame, "Show", () => this.sync());
		hooksecurefunc(frame, "Hide", () => this.sync());
		hooksecurefunc(frame, "SetTab", () => this.sync());
		hooksecurefunc(frame, "SetInspectUnit", () => this.sync());
		hooksecurefunc(frame, "SetInspectString", () => this.sync());
		hooksecurefunc(frame, "ClearInspectUnit", () => this.sync());
		this.frameHooked = true;
		this.sync();
	};
	disable(): void {
		if (this.enabled) return;
		this.enabled = true;
		if (!this.hooked) {
			hooksecurefunc("PlayerSpellsFrame_LoadUI", () => this.attach());
			hooksecurefunc("ShowUIPanel", () => this.sync());
			hooksecurefunc("HideUIPanel", () => this.sync());
			this.hooked = true;
		}
		this.attach();
		this.sync();
	}
	open(): void {
		this.full = false;
		PlayerSpellsUtil.OpenToClassTalentsTab();
		if (!PlayerSpellsFrame?.IsShown())
			PlayerSpellsUtil.OpenToClassSpecializationsTab();
		this.sync();
	}
	close(): void {
		if (PlayerSpellsFrame) HideUIPanel(PlayerSpellsFrame);
		this.sync();
	}
	openFull(): void {
		this.full = true;
		// Restore before opening so the hidden parent cannot block Blizzard's OnShow setup.
		this.syncing = true;
		this.frames.restore();
		PlayerSpellsUtil.OpenToClassTalentsTab();
		this.syncing = false;
		this.sync();
	}
	restore(): void {
		this.enabled = false;
		this.full = false;
		this.frames.restore();
	}
}
