import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInMounts } from "./built-in-mounts";
export class MountsModule implements IModule {
	readonly id = "mounts";
	private readonly refresh = () => this.view.invalidate();
	private readonly searchUpdated = () => this.view.onJournalSearchUpdated();
	private readonly equipmentChanged = () => this.view.refreshEquipment();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "right");
		else this.ui.closePanel("right", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: {
			invalidate(): void;
			onJournalSearchUpdated(): void;
			refreshEquipment(): void;
		},
		private readonly native: IBuiltInMounts,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("MOUNTS_CHANGED", this.refresh);
		this.events.subscribe("MOUNTS_SEARCH_CHANGED", this.searchUpdated);
		this.events.subscribe("MOUNTS_EQUIPMENT_CHANGED", this.equipmentChanged);
		this.events.subscribe("MOUNTS_VISIBILITY_CHANGED", this.sync);
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("MOUNTS_CHANGED", this.refresh);
		this.events.unsubscribe("MOUNTS_SEARCH_CHANGED", this.searchUpdated);
		this.events.unsubscribe("MOUNTS_EQUIPMENT_CHANGED", this.equipmentChanged);
		this.events.unsubscribe("MOUNTS_VISIBILITY_CHANGED", this.sync);
		this.native.restore();
	}
}
