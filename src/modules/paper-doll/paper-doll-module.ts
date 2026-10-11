import type {
	CharacterStat,
	EquipmentSlot,
	ICharacterClient,
} from "../../clients/character-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInPaperDoll } from "./built-in-paper-doll";

export interface PaperDollView {
	setEquipment(equipment: readonly EquipmentSlot[]): void;
	setStats(stats: readonly CharacterStat[]): void;
	refreshPreview(): void;
}
export class PaperDollModule implements IModule {
	readonly id = "paper-doll";
	private open = false;
	private readonly refreshStats = () => {
		if (this.open) this.view.setStats(this.character.getStats());
	};
	private readonly refreshPreview = () => {
		if (this.open) this.view.refreshPreview();
	};
	private readonly refresh = () => {
		if (!this.open) return;
		this.view.setEquipment(this.character.getEquipment());
		this.refreshStats();
		this.refreshPreview();
	};
	private readonly syncVisibility = () => {
		const open = this.character.isOpen();
		if (open === this.open) return;
		this.open = open;
		if (open) {
			this.refresh();
			this.ui.openPanel(this.id, "left");
		} else this.ui.closePanel("left");
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly character: Pick<
			ICharacterClient,
			"isOpen" | "getEquipment" | "getStats"
		>,
		private readonly view: PaperDollView,
		private readonly builtIn: IBuiltInPaperDoll,
	) {}
	disableBuiltIn(): void {
		this.builtIn.disable();
	}
	initialize(): void {
		this.events.subscribe("CHARACTER_VISIBILITY_CHANGED", this.syncVisibility);
		this.events.subscribe("PLAYER_EQUIPMENT_CHANGED", this.refresh);
		this.events.subscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.subscribe("CHARACTER_STATS_CHANGED", this.refreshStats);
		this.events.subscribe("CHARACTER_MODEL_CHANGED", this.refreshPreview);
		this.syncVisibility();
	}
	shutdown(): void {
		this.events.unsubscribe(
			"CHARACTER_VISIBILITY_CHANGED",
			this.syncVisibility,
		);
		this.events.unsubscribe("PLAYER_EQUIPMENT_CHANGED", this.refresh);
		this.events.unsubscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.unsubscribe("CHARACTER_STATS_CHANGED", this.refreshStats);
		this.events.unsubscribe("CHARACTER_MODEL_CHANGED", this.refreshPreview);
		if (this.open) this.ui.closePanel("left");
		this.open = false;
		this.builtIn.restore();
	}
}
