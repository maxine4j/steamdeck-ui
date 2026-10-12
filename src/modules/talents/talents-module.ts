import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInTalents } from "./built-in-talents";

export class TalentsModule implements IModule {
	readonly id = "talents";
	private nativeOpen = false;
	private readonly refresh = () => this.view.refresh();
	private readonly sync = () => {
		const open = this.native.isOpen();
		if (open && !this.nativeOpen) this.ui.openPanel(this.id, "left");
		if (!open && this.nativeOpen) this.ui.closePanel("left", this.id);
		this.nativeOpen = open;
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void },
		private readonly native: IBuiltInTalents,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("TALENTS_CHANGED", this.refresh);
		this.events.subscribe("COMBAT_STARTED", this.refresh);
		this.events.subscribe("COMBAT_ENDED", this.refresh);
		this.events.subscribe("TALENTS_VISIBILITY_CHANGED", this.sync);
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("TALENTS_CHANGED", this.refresh);
		this.events.unsubscribe("COMBAT_STARTED", this.refresh);
		this.events.unsubscribe("COMBAT_ENDED", this.refresh);
		this.events.unsubscribe("TALENTS_VISIBILITY_CHANGED", this.sync);
		this.nativeOpen = false;
		this.native.restore();
	}
}
