import type { ITransmogClient } from "../../clients/transmog-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export class TransmogModule implements IModule {
	readonly id = "transmog";
	private open = false;
	private readonly refresh = () => this.panel.refresh();
	private readonly sync = () => {
		const open = this.client.isOpen();
		if (this.open === open) return;
		this.open = open;
		if (open) this.ui.openPanel(this.id, "fullscreen");
		else this.ui.closePanel("fullscreen", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly client: Pick<
			ITransmogClient,
			"disable" | "restore" | "isOpen"
		>,
		private readonly panel: { refresh(): void },
	) {}
	disableBuiltIn(): void {
		this.client.disable();
	}
	initialize(): void {
		this.events.subscribe("TRANSMOG_VISIBILITY_CHANGED", this.sync);
		this.events.subscribe("TRANSMOG_CHANGED", this.refresh);
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("TRANSMOG_VISIBILITY_CHANGED", this.sync);
		this.events.unsubscribe("TRANSMOG_CHANGED", this.refresh);
		this.open = false;
		this.client.restore();
	}
}
