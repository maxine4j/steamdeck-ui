import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
export interface ISpellbookVisibility {
	disable(): void;
	restore(): void;
	isSpellbookOpen(): boolean;
}
export class SpellbookModule implements IModule {
	readonly id = "spellbook";
	private opened = false;
	private readonly refresh = () => this.view.refresh();
	private readonly sync = () => {
		const open = this.native.isSpellbookOpen();
		const previous = this.opened;
		this.opened = open;
		if (open && !previous) this.ui.openPanel(this.id, "left");
		if (!open && previous) this.ui.closePanel("left", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void },
		private readonly native: ISpellbookVisibility,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("SPELLBOOK_CHANGED", this.refresh);
		this.events.subscribe("COMBAT_ENDED", this.refresh);
		this.events.subscribe("SPELLBOOK_VISIBILITY_CHANGED", this.sync);
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("SPELLBOOK_CHANGED", this.refresh);
		this.events.unsubscribe("COMBAT_ENDED", this.refresh);
		this.events.unsubscribe("SPELLBOOK_VISIBILITY_CHANGED", this.sync);
		this.opened = false;
		this.native.restore();
	}
}
