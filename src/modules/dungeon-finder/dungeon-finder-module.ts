import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInDungeonFinder } from "./built-in-dungeon-finder";

export class DungeonFinderModule implements IModule {
	readonly id = "dungeon-finder";
	private readonly refresh = () => this.view.refresh();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "left");
		else this.ui.closePanel("left", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void },
		private readonly native: IBuiltInDungeonFinder,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("DUNGEON_FINDER_CHANGED", this.refresh);
		this.events.subscribe("DUNGEON_FINDER_VISIBILITY_CHANGED", this.sync);
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("DUNGEON_FINDER_CHANGED", this.refresh);
		this.events.unsubscribe("DUNGEON_FINDER_VISIBILITY_CHANGED", this.sync);
		this.native.restore();
	}
}
