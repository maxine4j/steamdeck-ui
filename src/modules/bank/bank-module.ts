import type { IBankClient } from "../../clients/bank-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { ApplicationEvent, IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export class BankModule implements IModule {
	readonly id = "bank";
	private open = false;
	private cancelRefresh?: () => void;
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly client: IBankClient,
		private readonly views: readonly { refresh(): void }[],
		private readonly native: { disable(): void; restore(): void },
		private readonly scheduler: ITaskScheduler,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	private readonly show = () => {
		this.open = true;
		this.client.setOpen(true);
		this.native.disable();
		this.ui.openPanel("bags", "right");
		for (const view of this.views) view.refresh();
		const kind = this.client.getState("standard").available
			? "bank"
			: "warband-bank";
		this.ui.openPanel(kind, "left", "bank");
	};
	private readonly closed = () => {
		if (!this.open) return;
		this.open = false;
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.client.setOpen(false);
		this.ui.closePanel("left", undefined, "bank");
	};
	private readonly refresh = () => {
		if (!this.open || this.cancelRefresh) return;
		this.cancelRefresh = this.scheduler.nextFrame(() => {
			this.cancelRefresh = undefined;
			if (this.open) for (const view of this.views) view.refresh();
		});
	};
	initialize(): void {
		this.events.subscribe("BANKFRAME_OPENED", this.show);
		this.events.subscribe("BANKFRAME_CLOSED", this.closed);
		for (const event of updates) this.events.subscribe(event, this.refresh);
	}
	shutdown(): void {
		this.events.unsubscribe("BANKFRAME_OPENED", this.show);
		this.events.unsubscribe("BANKFRAME_CLOSED", this.closed);
		for (const event of updates) this.events.unsubscribe(event, this.refresh);
		if (this.open) {
			this.client.close();
			this.closed();
		}
		this.native.restore();
	}
}

const updates: readonly ApplicationEvent[] = [
	"BAG_UPDATE_DELAYED",
	"BANK_CONTENTS_CHANGED",
	"BANK_TABS_CHANGED",
	"ACCOUNT_MONEY",
	"PLAYER_MONEY",
	"ITEM_DATA_LOAD_RESULT",
];
