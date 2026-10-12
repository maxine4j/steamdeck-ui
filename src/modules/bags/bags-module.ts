import type {
	IInventoryClient,
	InventoryItem,
} from "../../clients/inventory-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInBags } from "./built-in-bags";
export interface BagsView {
	setItems(items: readonly InventoryItem[]): void;
	setMoney(copper: number): void;
}
export class BagsModule implements IModule {
	readonly id = "bags";
	private open = false;
	private dirty = true;
	private cancelRefresh?: () => void;
	private readonly refresh = () => {
		this.dirty = true;
		if (!this.open || this.cancelRefresh) return;
		this.cancelRefresh = this.scheduler.nextFrame(() => {
			this.cancelRefresh = undefined;
			this.load();
		});
	};
	private load(): void {
		this.view.setItems(this.inventory.getItems());
		this.refreshMoney();
		this.dirty = false;
	}
	private readonly refreshMoney = () =>
		this.view.setMoney(this.inventory.getMoney());
	private readonly syncVisibility = () => {
		const open = this.inventory.isOpen();
		if (open === this.open) return;
		this.open = open;
		if (open) {
			if (this.dirty) this.load();
			this.ui.openPanel(this.id, "right");
		} else {
			this.cancelRefresh?.();
			this.cancelRefresh = undefined;
			this.ui.closePanel("right");
		}
	};
	constructor(
		private readonly ui: IUIOrchestrator,
		private readonly events: IEventBus,
		private readonly inventory: IInventoryClient,
		private readonly view: BagsView,
		private readonly builtIn: IBuiltInBags,
		private readonly scheduler: ITaskScheduler,
	) {}
	disableBuiltIn(): void {
		this.builtIn.disable();
	}
	initialize(): void {
		this.events.subscribe("BAG_UPDATE_DELAYED", this.refresh);
		this.events.subscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.subscribe("PLAYER_MONEY", this.refreshMoney);
		this.events.subscribe("BAG_VISIBILITY_CHANGED", this.syncVisibility);
		this.events.subscribe("BAG_OPEN", this.syncVisibility);
		this.events.subscribe("BAG_CLOSED", this.syncVisibility);
		this.dirty = true;
		this.refreshMoney();
		this.syncVisibility();
	}
	shutdown(): void {
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.events.unsubscribe("BAG_UPDATE_DELAYED", this.refresh);
		this.events.unsubscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.unsubscribe("PLAYER_MONEY", this.refreshMoney);
		this.events.unsubscribe("BAG_VISIBILITY_CHANGED", this.syncVisibility);
		this.events.unsubscribe("BAG_OPEN", this.syncVisibility);
		this.events.unsubscribe("BAG_CLOSED", this.syncVisibility);
		if (this.open) this.ui.closePanel("right");
		this.open = false;
		this.builtIn.restore();
	}
}
