import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInTalents } from "./built-in-talents";

export class TalentsModule implements IModule {
	readonly id = "talents";
	private nativeOpen = false;
	private fullOpen = false;
	private readonly refresh = () => {
		this.view.refresh();
		this.tree?.refresh();
	};
	private readonly sync = () => {
		const open = this.native.isOpen();
		const full = this.native.isFullOpen();
		const wasOpen = this.nativeOpen;
		const wasFull = this.fullOpen;
		// Update before mounting/unmounting: native hooks can synchronously emit visibility.
		this.nativeOpen = open;
		this.fullOpen = full;
		if (open && !wasOpen) this.ui.openPanel(this.id, "left");
		if (!open && wasOpen) this.ui.closePanel("left", this.id);
		if (full && !wasFull) this.ui.openPanel("talent-tree", "fullscreen");
		if (!full && wasFull) this.ui.closePanel("fullscreen", "talent-tree");
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void },
		private readonly native: IBuiltInTalents,
		private readonly tree?: { refresh(): void },
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
		this.fullOpen = false;
		this.native.restore();
	}
}
