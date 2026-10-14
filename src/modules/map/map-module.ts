import type { IMapClient } from "../../clients/map-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { EventHandler, IEventBus } from "../../events/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
export class MapModule implements IModule {
	readonly id = "map";
	private open = false;
	private readonly update: DeferredRefresh;
	private readonly refresh = () => this.update.invalidate();
	private readonly details: EventHandler<"MAP_DETAILS_CHANGED"> = ({ id }) =>
		this.view.showDetails(id);
	private readonly visibility = () => {
		const open = this.client.isOpen();
		if (open === this.open) return;
		// Set state before mounting/closing: native scripts can emit recursively.
		this.open = open;
		if (open) this.ui.openPanel(this.id, "fullscreen");
		else this.ui.closePanel("fullscreen", this.id);
		this.update.setActive(open);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly client: IMapClient,
		private readonly view: { refresh(): void; showDetails(id?: number): void },
		scheduler: ITaskScheduler,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.view.refresh());
	}
	disableBuiltIn(): void {
		this.client.disable();
	}
	initialize(): void {
		this.events.subscribe("MAP_VISIBILITY_CHANGED", this.visibility);
		this.events.subscribe("MAP_DETAILS_CHANGED", this.details);
		this.events.subscribe("MAP_NAVIGATION_CHANGED", this.refresh);
		this.visibility();
	}
	shutdown(): void {
		this.events.unsubscribe("MAP_VISIBILITY_CHANGED", this.visibility);
		this.events.unsubscribe("MAP_DETAILS_CHANGED", this.details);
		this.events.unsubscribe("MAP_NAVIGATION_CHANGED", this.refresh);
		this.update.setActive(false);
		if (this.open) this.ui.closePanel("fullscreen", this.id);
		this.open = false;
		this.client.restore();
	}
}
