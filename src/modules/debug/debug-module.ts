import type { DebugClient } from "../../clients/debug-client";
import type { IEventBus } from "../../events/types";
import type { IPanel } from "../../ui/panel/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export class DebugModule implements IModule {
	readonly id = "debug";
	private registered = false;
	private readonly open = () =>
		this.ui.openPanel(this.errors.id, "left", "debug");
	constructor(
		private readonly ui: Pick<
			IUIOrchestrator,
			"registerPanel" | "openPanel" | "closePanel"
		>,
		private readonly events: IEventBus,
		private readonly client: Pick<
			DebugClient,
			"diagnostics" | "initialize" | "shutdown"
		>,
		private readonly logs: IPanel,
		private readonly cache: IPanel,
		private readonly errors: IPanel,
	) {}
	disableBuiltIn(): void {}
	initialize(): void {
		if (!this.registered) {
			this.ui.registerPanel(this.logs, "left", "debug");
			this.ui.registerPanel(this.cache, "left", "debug");
			this.ui.registerPanel(this.errors, "left", "debug");
			this.registered = true;
		}
		this.events.subscribe("DEBUG_OPEN_REQUESTED", this.open);
		this.client.initialize();
	}
	shutdown(): void {
		this.events.unsubscribe("DEBUG_OPEN_REQUESTED", this.open);
		this.ui.closePanel("left", undefined, "debug");
		this.client.shutdown();
	}
}
