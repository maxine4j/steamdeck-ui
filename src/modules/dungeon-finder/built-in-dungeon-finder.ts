import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export interface IBuiltInDungeonFinder {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class BuiltInDungeonFinder implements IBuiltInDungeonFinder {
	private enabled = false;
	private hooked = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isOpen(): boolean {
		return PVEFrame.IsShown() && LFDParentFrame.IsShown();
	}
	open(): void {
		PVEFrame_ShowFrame("GroupFinderFrame", LFDParentFrame);
	}
	close(): void {
		HideUIPanel(PVEFrame);
	}
	private readonly sync = () => {
		if (!this.enabled) return;
		if (this.isOpen()) this.frames.suppress([PVEFrame]);
		else this.frames.restore();
		this.events.emit("DUNGEON_FINDER_VISIBILITY_CHANGED");
	};
	disable(): void {
		if (this.enabled) return;
		(C_AddOns.LoadAddOn as unknown as (this: void, name: string) => void)(
			"Blizzard_GroupFinder",
		);
		if (!this.hooked) {
			PVEFrame.HookScript("OnShow", this.sync);
			PVEFrame.HookScript("OnHide", this.sync);
			LFDParentFrame.HookScript("OnShow", this.sync);
			LFDParentFrame.HookScript("OnHide", this.sync);
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
