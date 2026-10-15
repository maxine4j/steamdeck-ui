import type { IAppearancesClient } from "../../clients/appearances-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export interface IBuiltInAppearances {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class AppearancesModule implements IModule {
	readonly id = "appearances";
	private readonly refresh = (payload?: {
		sourceId?: number;
		appearanceId?: number;
	}) => {
		if (payload?.appearanceId !== undefined)
			this.client.refresh(undefined, payload.appearanceId);
		else this.client.refresh(payload?.sourceId);
	};
	private readonly itemLoaded = (payload?: {
		id: number;
		success: boolean;
	}) => {
		if (payload?.success) this.client.refreshItem(payload.id);
	};
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "right");
		else this.ui.closePanel("right", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly native: IBuiltInAppearances,
		private readonly client: Pick<
			IAppearancesClient,
			"refresh" | "refreshItem" | "stop"
		>,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("APPEARANCES_CHANGED", this.refresh);
		this.events.subscribe("ITEM_DATA_LOAD_RESULT", this.itemLoaded);
		this.events.subscribe("APPEARANCES_VISIBILITY_CHANGED", this.sync);
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("APPEARANCES_CHANGED", this.refresh);
		this.events.unsubscribe("ITEM_DATA_LOAD_RESULT", this.itemLoaded);
		this.events.unsubscribe("APPEARANCES_VISIBILITY_CHANGED", this.sync);
		this.client.stop();
		this.native.restore();
	}
}
