import type { IHeirloomsClient } from "../../clients/heirlooms-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
export class HeirloomsModule implements IModule {
	readonly id = "heirlooms";
	private readonly refresh = (payload?: { id?: number }) =>
		this.client.refreshEntry(payload?.id);
	private readonly resume = () => this.view.resume();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "right");
		else this.ui.closePanel("right", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly native: {
			disable(): void;
			restore(): void;
			isOpen(): boolean;
		},
		private readonly client: Pick<
			IHeirloomsClient,
			"prefetch" | "refreshEntry" | "stop"
		>,
		private readonly view: { resume(): void },
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("HEIRLOOMS_CHANGED", this.refresh);
		this.events.subscribe("HEIRLOOMS_VISIBILITY_CHANGED", this.sync);
		this.events.subscribe("COMBAT_ENDED", this.resume);
		this.client.prefetch();
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("HEIRLOOMS_CHANGED", this.refresh);
		this.events.unsubscribe("HEIRLOOMS_VISIBILITY_CHANGED", this.sync);
		this.events.unsubscribe("COMBAT_ENDED", this.resume);
		this.client.stop();
		this.native.restore();
	}
}
