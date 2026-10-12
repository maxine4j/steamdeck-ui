import type {
	CharacterIdentity,
	CharacterStat,
	EquipmentSlot,
	ICharacterClient,
} from "../../clients/character-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInPaperDoll } from "./built-in-paper-doll";

export interface PaperDollView {
	setIdentity(identity: CharacterIdentity): void;
	setEquipment(equipment: readonly EquipmentSlot[]): void;
	setStats(stats: readonly CharacterStat[]): void;
	refreshPreview(): void;
}
export class PaperDollModule implements IModule {
	readonly id = "paper-doll";
	private open = false;
	private identityDirty = true;
	private equipmentDirty = true;
	private statsDirty = true;
	private previewDirty = true;
	private readonly task: DeferredRefresh;
	private updateStats(): void {
		if (!this.open || !this.statsDirty) return;
		this.view.setStats(this.character.getStats());
		this.statsDirty = false;
	}
	private update(): void {
		if (!this.open) return;
		if (this.identityDirty) {
			this.view.setIdentity(this.character.getIdentity());
			this.identityDirty = false;
		}
		if (this.equipmentDirty) {
			this.view.setEquipment(this.character.getEquipment());
			this.equipmentDirty = false;
			this.previewDirty = true;
		}
		this.updateStats();
		if (this.previewDirty) {
			this.view.refreshPreview();
			this.previewDirty = false;
		}
	}
	private readonly refreshStats = () => {
		this.statsDirty = true;
		this.task.invalidate();
	};
	private readonly refreshIdentity = () => {
		this.identityDirty = true;
		this.task.invalidate();
	};
	private readonly refreshPreview = () => {
		this.previewDirty = true;
		this.task.invalidate();
	};
	private readonly refresh = () => {
		this.equipmentDirty = true;
		this.statsDirty = true;
		this.task.invalidate();
	};
	private readonly syncVisibility = () => {
		const open = this.builtIn.isOpen();
		if (open === this.open) return;
		this.open = open;
		this.task.setActive(open);
		if (open) {
			this.update();
			this.ui.openPanel(this.id, "left");
		} else this.ui.closePanel("left", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly character: Pick<
			ICharacterClient,
			"getEquipment" | "getStats" | "getIdentity"
		>,
		private readonly view: PaperDollView,
		private readonly builtIn: IBuiltInPaperDoll,
		scheduler: ITaskScheduler,
	) {
		this.task = new DeferredRefresh(scheduler, () => this.update());
	}
	disableBuiltIn(): void {
		this.builtIn.disable();
	}
	initialize(): void {
		this.events.subscribe("CHARACTER_IDENTITY_CHANGED", this.refreshIdentity);
		this.events.subscribe("CHARACTER_VISIBILITY_CHANGED", this.syncVisibility);
		this.events.subscribe("PLAYER_EQUIPMENT_CHANGED", this.refresh);
		this.events.subscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.subscribe("CHARACTER_STATS_CHANGED", this.refreshStats);
		this.events.subscribe("CHARACTER_MODEL_CHANGED", this.refreshPreview);
		this.syncVisibility();
	}
	shutdown(): void {
		this.events.unsubscribe("CHARACTER_IDENTITY_CHANGED", this.refreshIdentity);
		this.task.setActive(false);
		this.events.unsubscribe(
			"CHARACTER_VISIBILITY_CHANGED",
			this.syncVisibility,
		);
		this.events.unsubscribe("PLAYER_EQUIPMENT_CHANGED", this.refresh);
		this.events.unsubscribe("ITEM_DATA_LOAD_RESULT", this.refresh);
		this.events.unsubscribe("CHARACTER_STATS_CHANGED", this.refreshStats);
		this.events.unsubscribe("CHARACTER_MODEL_CHANGED", this.refreshPreview);
		if (this.open) this.ui.closePanel("left", this.id);
		this.open = false;
		this.builtIn.restore();
	}
}
