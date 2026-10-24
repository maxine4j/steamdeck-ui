import type { IObjectiveTrackerClient } from "../../clients/objective-tracker-client";
import type { IEventBus } from "../../events/types";
import type { IModule } from "../types";

export class ObjectiveTrackerModule implements IModule {
	readonly id = "objective-tracker";
	constructor(
		private readonly events: IEventBus,
		private readonly client: IObjectiveTrackerClient,
	) {}
	private readonly selectNext = () => this.client.selectNext();
	private readonly toggle = () => this.client.toggle();
	disableBuiltIn(): void {}
	initialize(): void {
		this.events.subscribe("OBJECTIVE_NEXT_REQUESTED", this.selectNext);
		this.events.subscribe("OBJECTIVE_TRACKER_TOGGLE_REQUESTED", this.toggle);
	}
	shutdown(): void {
		this.events.unsubscribe("OBJECTIVE_NEXT_REQUESTED", this.selectNext);
		this.events.unsubscribe("OBJECTIVE_TRACKER_TOGGLE_REQUESTED", this.toggle);
	}
}
