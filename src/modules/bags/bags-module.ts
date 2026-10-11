import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
/** Placeholder domain: requests presentation only; no inventory behavior. */
export class BagsModule implements IModule {
	readonly id = "bags";
	constructor(private readonly ui: IUIOrchestrator) {}
	initialize(): void {
		this.ui.openPanel(this.id, "left");
	}
	shutdown(): void {
		this.ui.closePanel("left");
	}
}
