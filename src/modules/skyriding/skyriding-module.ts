import type {
	ISkyridingClient,
	SkyridingState,
} from "../../clients/skyriding-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IModule } from "../types";

export interface SkyridingView {
	render(state: SkyridingState): void;
	hide(): void;
	destroy(): void;
}

export class SkyridingModule implements IModule {
	readonly id = "skyriding";
	private running = false;
	private cancel?: () => void;
	constructor(
		private readonly client: ISkyridingClient,
		private readonly view: SkyridingView,
		private readonly events: IEventBus,
		private readonly scheduler: ITaskScheduler,
	) {}
	disableBuiltIn(): void {}
	initialize(): void {
		if (this.running) return;
		this.running = true;
		this.events.subscribe("SKYRIDING_STATE_CHANGED", this.refresh);
		this.events.subscribe("SKYRIDING_SUSPENDED", this.suspend);
		this.refresh();
	}
	shutdown(): void {
		this.running = false;
		this.events.unsubscribe("SKYRIDING_STATE_CHANGED", this.refresh);
		this.events.unsubscribe("SKYRIDING_SUSPENDED", this.suspend);
		this.suspend();
		this.view.destroy();
	}
	private readonly suspend = (): void => {
		this.cancel?.();
		this.cancel = undefined;
		this.view.hide();
	};
	private readonly refresh = (): void => {
		this.cancel?.();
		this.cancel = undefined;
		if (!this.running) return;
		const state = this.client.read();
		if (!state.active) {
			this.view.hide();
			return;
		}
		this.view.render(state);
		this.cancel = this.scheduler.delay(0.05, this.refresh);
	};
}
