import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInCurrency } from "./built-in-currency";

export class CurrencyModule implements IModule {
	readonly id = "currency";
	private nativeOpen = false;
	private readonly refresh = () => this.view.refresh();
	private readonly succeeded = () => this.view.transferResult(true);
	private readonly rejected = () => this.view.transferResult(false);
	private readonly sync = () => {
		const open = this.native.isOpen();
		if (open && !this.nativeOpen) this.ui.openPanel(this.id, "left");
		if (!open && this.nativeOpen) {
			this.view.closeOptions();
			this.ui.closePanel("left", this.id);
		}
		this.nativeOpen = open;
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: {
			refresh(): void;
			closeOptions(): void;
			transferResult(success: boolean): void;
		},
		private readonly native: IBuiltInCurrency,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("CURRENCY_CHANGED", this.refresh);
		this.events.subscribe("CURRENCY_TRANSFER_SUCCEEDED", this.succeeded);
		this.events.subscribe("CURRENCY_TRANSFER_REJECTED", this.rejected);
		this.events.subscribe("CURRENCY_VISIBILITY_CHANGED", this.sync);
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("CURRENCY_CHANGED", this.refresh);
		this.events.unsubscribe("CURRENCY_TRANSFER_SUCCEEDED", this.succeeded);
		this.events.unsubscribe("CURRENCY_TRANSFER_REJECTED", this.rejected);
		this.events.unsubscribe("CURRENCY_VISIBILITY_CHANGED", this.sync);
		this.view.closeOptions();
		this.nativeOpen = false;
		this.native.restore();
	}
}
