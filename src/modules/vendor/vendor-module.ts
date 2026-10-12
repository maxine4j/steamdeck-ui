import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IVendorClient } from "../../clients/vendor-client";
import type { ApplicationEvent, IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInVendor } from "./built-in-vendor";

const updates: ApplicationEvent[] = [
	"MERCHANT_UPDATE",
	"MERCHANT_FILTER_ITEM_UPDATE",
	"PLAYER_MONEY",
	"BAG_UPDATE_DELAYED",
	"PLAYER_EQUIPMENT_CHANGED",
	"GUILDBANK_UPDATE_MONEY",
	"GUILDBANK_UPDATE_WITHDRAWMONEY",
	"ITEM_DATA_LOAD_RESULT",
	"CURRENCY_CHANGED",
];
export class VendorModule implements IModule {
	readonly id = "vendor";
	private open = false;
	private cancelRefresh?: () => void;
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly client: IVendorClient,
		private readonly views: readonly { refresh(): void }[],
		private readonly native: IBuiltInVendor,
		private readonly scheduler: ITaskScheduler,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	private readonly refresh = () => {
		if (!this.open || this.cancelRefresh) return;
		this.cancelRefresh = this.scheduler.nextFrame(() => {
			this.cancelRefresh = undefined;
			if (this.open) for (const view of this.views) view.refresh();
		});
	};
	private readonly show = () => {
		this.open = true;
		this.client.setOpen(true);
		this.native.disable();
		this.client.ensureBagsOpen();
		this.events.emit("BAG_VISIBILITY_CHANGED");
		for (const view of this.views) view.refresh();
		this.ui.openPanel("vendor", "left", "merchant");
	};
	private readonly closed = () => {
		this.open = false;
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.client.setOpen(false);
		this.ui.closePanel("left", undefined, "merchant");
	};
	close(): void {
		this.client.close();
		this.closed();
	}
	initialize(): void {
		this.events.subscribe("MERCHANT_SHOW", this.show);
		this.events.subscribe("MERCHANT_CLOSED", this.closed);
		for (const event of updates) this.events.subscribe(event, this.refresh);
	}
	shutdown(): void {
		this.events.unsubscribe("MERCHANT_SHOW", this.show);
		this.events.unsubscribe("MERCHANT_CLOSED", this.closed);
		for (const event of updates) this.events.unsubscribe(event, this.refresh);
		if (this.open) this.close();
		this.native.restore();
	}
}
