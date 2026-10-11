import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";
export interface IBuiltInMounts {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class BuiltInMounts implements IBuiltInMounts {
	private enabled = false;
	private hooked = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isOpen(): boolean {
		return CollectionsJournal.IsShown() && MountJournal.IsShown();
	}
	close(): void {
		HideUIPanel(CollectionsJournal);
	}
	private readonly sync = () => {
		if (!this.enabled) return;
		if (this.isOpen()) this.frames.suppress([CollectionsJournal]);
		else this.frames.restore();
		this.events.emit("MOUNTS_VISIBILITY_CHANGED");
	};
	disable(): void {
		if (this.enabled) return;
		(C_AddOns.LoadAddOn as unknown as (this: void, name: string) => void)(
			"Blizzard_Collections",
		);
		if (!this.hooked) {
			MountJournal.HookScript("OnShow", this.sync);
			MountJournal.HookScript("OnHide", this.sync);
			CollectionsJournal.HookScript("OnShow", this.sync);
			CollectionsJournal.HookScript("OnHide", this.sync);
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
