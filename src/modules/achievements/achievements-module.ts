import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInAchievements } from "./built-in-achievements";
export class AchievementsModule implements IModule {
	readonly id = "achievements";
	private readonly refresh = () => this.view.refresh();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "fullscreen");
		else this.ui.closePanel("fullscreen", this.id);
	};
	private readonly selected = ({ id }: { id: number }) => {
		this.sync();
		this.view.selectAchievement(id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: {
			refresh(): void;
			selectAchievement(id: number): void;
		},
		private readonly native: IBuiltInAchievements,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("ACHIEVEMENTS_CHANGED", this.refresh);
		this.events.subscribe("ACHIEVEMENTS_VISIBILITY_CHANGED", this.sync);
		this.events.subscribe("ACHIEVEMENTS_SELECTED", this.selected);
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("ACHIEVEMENTS_CHANGED", this.refresh);
		this.events.unsubscribe("ACHIEVEMENTS_VISIBILITY_CHANGED", this.sync);
		this.events.unsubscribe("ACHIEVEMENTS_SELECTED", this.selected);
		this.native.restore();
	}
}
