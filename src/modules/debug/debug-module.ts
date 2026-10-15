import type { DebugClient } from "../../clients/debug-client";
import type { ApplicationEvent, IEventBus } from "../../events/types";
import type { IPanel } from "../../ui/panel/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export class DebugModule implements IModule {
	readonly id = "debug";
	private registered = false;
	private readonly open = () =>
		this.ui.openPanel(this.logs.id, "left", "debug");
	private readonly eventHandlers: [ApplicationEvent, () => void][] = [
		"PLAYER_LOGIN",
		"COMBAT_STARTED",
		"COMBAT_ENDED",
		"MOUNTS_CHANGED",
		"MOUNTS_SEARCH_CHANGED",
		"TOYS_CHANGED",
		"PETS_CHANGED",
		"APPEARANCES_CHANGED",
		"ACHIEVEMENTS_CHANGED",
	].map((event) => [
		event as ApplicationEvent,
		() => this.client.diagnostics.log("info", `event ${event}`),
	]);
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
	) {}
	disableBuiltIn(): void {}
	initialize(): void {
		if (!this.registered) {
			this.ui.registerPanel(this.logs, "left", "debug");
			this.ui.registerPanel(this.cache, "left", "debug");
			this.registered = true;
		}
		this.events.subscribe("DEBUG_OPEN_REQUESTED", this.open);
		for (const [event, handler] of this.eventHandlers)
			this.events.subscribe(event, handler);
		this.client.initialize();
	}
	shutdown(): void {
		this.events.unsubscribe("DEBUG_OPEN_REQUESTED", this.open);
		for (const [event, handler] of this.eventHandlers)
			this.events.unsubscribe(event, handler);
		this.ui.closePanel("left", undefined, "debug");
		this.client.shutdown();
	}
}
