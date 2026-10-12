import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInToys } from "./built-in-toys";

export class ToysModule implements IModule {
	readonly id = "toys";
	private readonly refresh = () => this.view.refresh();
	private readonly cooldown = () => this.view.refreshCooldowns();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "right");
		else this.ui.closePanel("right", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void; refreshCooldowns(): void },
		private readonly native: IBuiltInToys,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("TOYS_CHANGED", this.refresh);
		this.events.subscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.subscribe("TOYS_COOLDOWN_CHANGED", this.cooldown);
		this.events.subscribe("TOYS_VISIBILITY_CHANGED", this.sync);
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("TOYS_CHANGED", this.refresh);
		this.events.unsubscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.unsubscribe("TOYS_COOLDOWN_CHANGED", this.cooldown);
		this.events.unsubscribe("TOYS_VISIBILITY_CHANGED", this.sync);
		this.native.restore();
	}
}
