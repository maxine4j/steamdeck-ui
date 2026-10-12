import type { IEventBus } from "../../events/types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";
export interface IBuiltInAchievements {
	disable(): void;
	restore(): void;
	close(): void;
	isOpen(): boolean;
}
export class BuiltInAchievements implements IBuiltInAchievements {
	private enabled = false;
	private hooked = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly events: IEventBus,
	) {}
	isOpen(): boolean {
		return !!AchievementFrame?.IsShown() && AchievementFrame.selectedTab === 1;
	}
	close(): void {
		if (AchievementFrame) HideUIPanel(AchievementFrame);
	}
	private readonly sync = () => {
		if (!this.enabled) return;
		if (this.isOpen() && AchievementFrame)
			this.frames.suppress([AchievementFrame]);
		else this.frames.restore();
		this.events.emit("ACHIEVEMENTS_VISIBILITY_CHANGED");
	};
	disable(): void {
		if (this.enabled || !AchievementFrame_LoadUI() || !AchievementFrame) return;
		if (!this.hooked) {
			AchievementFrame.HookScript("OnShow", () => this.sync());
			AchievementFrame.HookScript("OnHide", () => this.sync());
			const hook = hooksecurefunc as unknown as (
				this: void,
				name: string,
				callback: (this: void, id: number) => void,
			) => void;
			hook("AchievementFrame_SelectAchievement", (id) => {
				if (this.enabled && this.isOpen())
					this.events.emit("ACHIEVEMENTS_SELECTED", { id });
			});
			hook("AchievementFrame_UpdateTabs", () => this.sync());
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
