import type {
	IInventoryClient,
	InventoryItem,
} from "../../clients/inventory-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInBags } from "./built-in-bags";
export interface BagsView {
	setItems(items: readonly InventoryItem[]): void;
}
export class BagsModule implements IModule {
	readonly id = "bags";
	private open = false;
	private readonly refresh = () =>
		this.view.setItems(this.inventory.getItems());
	private readonly syncVisibility = () => {
		const open = this.inventory.isOpen();
		if (open === this.open) return;
		this.open = open;
		if (open) {
			this.refresh();
			this.ui.openPanel(this.id, "right");
		} else this.ui.closePanel("right");
	};
	constructor(
		private readonly ui: IUIOrchestrator,
		private readonly events: IEventBus,
		private readonly inventory: IInventoryClient,
		private readonly view: BagsView,
		private readonly builtIn: IBuiltInBags,
	) {}
	disableBuiltIn(): void {
		this.builtIn.disable();
	}
	initialize(): void {
		this.events.subscribe("BAG_UPDATE_DELAYED", this.refresh);
		this.events.subscribe("BAG_VISIBILITY_CHANGED", this.syncVisibility);
		this.events.subscribe("BAG_OPEN", this.syncVisibility);
		this.events.subscribe("BAG_CLOSED", this.syncVisibility);
		this.refresh();
		this.syncVisibility();
	}
	shutdown(): void {
		this.events.unsubscribe("BAG_UPDATE_DELAYED", this.refresh);
		this.events.unsubscribe("BAG_VISIBILITY_CHANGED", this.syncVisibility);
		this.events.unsubscribe("BAG_OPEN", this.syncVisibility);
		this.events.unsubscribe("BAG_CLOSED", this.syncVisibility);
		if (this.open) this.ui.closePanel("right");
		this.open = false;
		this.builtIn.restore();
	}
}
