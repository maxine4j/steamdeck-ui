import type { IEventBus } from "../../events/types";
import type { IPanel } from "../../ui/panel/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
export class ControllerOptionsModule implements IModule {
	readonly id = "controller-options";
	private registered = false;
	private readonly open = () =>
		this.ui.openPanel(this.panel.id, "fullscreen", this.id);
	constructor(
		private readonly ui: Pick<
			IUIOrchestrator,
			"registerPanel" | "openPanel" | "closePanel"
		>,
		private readonly events: IEventBus,
		private readonly panel: IPanel,
	) {}
	disableBuiltIn(): void {}
	initialize(): void {
		if (!this.registered) {
			this.ui.registerPanel(this.panel, "fullscreen", this.id);
			this.registered = true;
		}
		this.events.subscribe("CONTROLLER_OPTIONS_OPEN_REQUESTED", this.open);
	}
	shutdown(): void {
		this.events.unsubscribe("CONTROLLER_OPTIONS_OPEN_REQUESTED", this.open);
		this.ui.closePanel("fullscreen", undefined, this.id);
	}
}
