import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";
import type { IBuiltInTitles } from "./built-in-titles";
export class TitlesModule implements IModule {
	readonly id = "titles";
	private readonly refresh = () => this.view.refresh();
	private readonly open = () => this.ui.openPanel(this.id, "left");
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel">,
		private readonly events: IEventBus,
		private readonly view: { refresh(): void },
		private readonly native: IBuiltInTitles,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("TITLES_CHANGED", this.refresh);
		this.events.subscribe("TITLES_OPEN", this.open);
	}
	shutdown(): void {
		this.events.unsubscribe("TITLES_CHANGED", this.refresh);
		this.events.unsubscribe("TITLES_OPEN", this.open);
		this.native.restore();
	}
}
