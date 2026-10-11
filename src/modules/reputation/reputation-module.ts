import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInReputation } from "./built-in-reputation";

export class ReputationModule implements IModule {
	readonly id = "reputation";
	private nativeOpen = false;
	private readonly refresh = () => this.view.refresh();
	private readonly sync = () => {
		const open = this.native.isOpen();
		if (open && !this.nativeOpen) this.ui.openPanel(this.id, "left");
		if (this.nativeOpen && !open) this.ui.closePanel("left", this.id);
		this.nativeOpen = open;
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void },
		private readonly native: IBuiltInReputation,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("REPUTATION_CHANGED", this.refresh);
		this.events.subscribe("REPUTATION_VISIBILITY_CHANGED", this.sync);
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("REPUTATION_CHANGED", this.refresh);
		this.events.unsubscribe("REPUTATION_VISIBILITY_CHANGED", this.sync);
		this.nativeOpen = false;
		this.native.restore();
	}
}
