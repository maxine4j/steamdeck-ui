import type { IToysClient } from "../../clients/toys-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInToys } from "./built-in-toys";

export class ToysModule implements IModule {
	readonly id = "toys";
	private readonly refresh = (payload?: { id: number }) => {
		this.journal.refreshEntry(payload?.id);
	};
	private readonly cooldown = () => this.view.refreshCooldowns();
	private readonly itemLoaded = (payload?: {
		id: number;
		success: boolean;
	}) => {
		if (payload?.success) this.journal.refreshItem(payload.id);
	};
	private readonly resume = () => this.view.resume();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "right");
		else this.ui.closePanel("right", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: {
			refreshCooldowns(): void;
			resume(): void;
		},
		private readonly native: IBuiltInToys,
		private readonly journal: Pick<
			IToysClient,
			"prefetch" | "refreshEntry" | "refreshItem" | "stop"
		>,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("COMBAT_ENDED", this.resume);
		this.events.subscribe("TOYS_CHANGED", this.refresh);
		this.events.subscribe("ITEM_DATA_LOAD_RESULT", this.itemLoaded);
		this.events.subscribe("TOYS_COOLDOWN_CHANGED", this.cooldown);
		this.events.subscribe("TOYS_VISIBILITY_CHANGED", this.sync);
		this.journal.prefetch();
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("COMBAT_ENDED", this.resume);
		this.events.unsubscribe("TOYS_CHANGED", this.refresh);
		this.events.unsubscribe("ITEM_DATA_LOAD_RESULT", this.itemLoaded);
		this.events.unsubscribe("TOYS_COOLDOWN_CHANGED", this.cooldown);
		this.events.unsubscribe("TOYS_VISIBILITY_CHANGED", this.sync);
		this.journal.stop();
		this.native.restore();
	}
}
