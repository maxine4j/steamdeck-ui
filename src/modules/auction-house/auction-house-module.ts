import type { IAuctionHouseClient } from "../../clients/auction-house-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { EventHandler, IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
export class AuctionHouseModule implements IModule {
	readonly id = "auction-house";
	private open = false;
	private cancelRefresh?: () => void;
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly client: IAuctionHouseClient,
		private readonly views: readonly { refresh(): void; reset(): void }[],
		private readonly scheduler: ITaskScheduler,
	) {}
	disableBuiltIn(): void {
		this.client.disableBuiltIn();
	}
	private readonly show = () => {
		this.open = true;
		this.client.disableBuiltIn();
		this.client.setOpen(true);
		this.events.emit("BAG_VISIBILITY_CHANGED");
		this.ui.openPanel("bags", "right");
		for (const view of this.views) view.reset();
		this.client.search("");
		for (const view of this.views) view.refresh();
		this.ui.openPanel("auction-buy", "left", "auction-house");
	};
	private readonly selected = () => {
		if (this.open) {
			for (const view of this.views) view.refresh();
			this.ui.openPanel("auction-sell", "left", "auction-house");
		}
	};
	private readonly changed: EventHandler<"AUCTION_HOUSE_CHANGED"> = (
		update,
	) => {
		if (this.open) {
			this.client.update(update);
			this.refresh();
		}
	};
	private readonly refresh = () => {
		if (!this.open || this.cancelRefresh) return;
		this.cancelRefresh = this.scheduler.nextFrame(() => {
			this.cancelRefresh = undefined;
			if (this.open) for (const view of this.views) view.refresh();
		});
	};
	private readonly closed = () => {
		if (!this.open) return;
		this.open = false;
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.client.setOpen(false);
		this.ui.closePanel("left", undefined, "auction-house");
	};
	close(): void {
		if (!this.open) return;
		this.open = false;
		this.client.close();
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.ui.closePanel("left", undefined, "auction-house");
	}
	initialize(): void {
		this.events.subscribe("AUCTION_HOUSE_SHOW", this.show);
		this.events.subscribe("AUCTION_HOUSE_CLOSED", this.closed);
		this.events.subscribe("AUCTION_HOUSE_CHANGED", this.changed);
		this.events.subscribe("AUCTION_SELL_ITEM_SELECTED", this.selected);
		this.events.subscribe("PLAYER_MONEY", this.refresh);
		this.events.subscribe("BAG_UPDATE_DELAYED", this.refresh);
		this.events.subscribe("DIALOGUE_ADDON_LOADED", this.disable);
	}
	private readonly disable = () => this.client.disableBuiltIn();
	shutdown(): void {
		this.events.unsubscribe("AUCTION_HOUSE_SHOW", this.show);
		this.events.unsubscribe("AUCTION_HOUSE_CLOSED", this.closed);
		this.events.unsubscribe("AUCTION_HOUSE_CHANGED", this.changed);
		this.events.unsubscribe("AUCTION_SELL_ITEM_SELECTED", this.selected);
		this.events.unsubscribe("PLAYER_MONEY", this.refresh);
		this.events.unsubscribe("BAG_UPDATE_DELAYED", this.refresh);
		this.events.unsubscribe("DIALOGUE_ADDON_LOADED", this.disable);
		this.close();
		this.client.restoreBuiltIn();
	}
}
