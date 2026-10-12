import type { IActionBarClient } from "../../clients/action-bar-client";
import type { IEventBus } from "../../events/types";
import type { IModule } from "../types";

export class ActionBarModule implements IModule {
	readonly id = "action-bar";
	private active = false;
	private wanted = false;
	private readonly refresh = () => {
		if (this.active) this.view.refresh();
	};
	private readonly syncNative = () => {
		if (this.active) this.client.syncBuiltInVisibility();
	};
	private readonly refreshContents = () => {
		if (this.active) this.view.refreshContents?.();
	};
	private readonly reconcile = () => {
		if (!this.client.canModify()) return;
		if (this.wanted && !this.active) {
			this.client.disableBuiltIn();
			this.view.initialize();
			this.active = true;
		} else if (!this.wanted) {
			this.client.restore();
			if (this.active) this.view.destroy();
			this.active = false;
			this.events.unsubscribe("COMBAT_ENDED", this.reconcile);
		} else {
			this.refreshContents();
			this.refresh();
		}
		this.syncNative();
	};
	constructor(
		private readonly events: IEventBus,
		private readonly client: Pick<
			IActionBarClient,
			"canModify" | "disableBuiltIn" | "syncBuiltInVisibility" | "restore"
		>,
		private readonly view: {
			initialize(): void;
			refresh(): void;
			refreshContents?(): void;
			destroy(): void;
		},
	) {}
	disableBuiltIn(): void {
		if (this.client.canModify()) this.client.disableBuiltIn();
	}
	initialize(): void {
		this.wanted = true;
		this.events.subscribe("ACTION_BAR_CHANGED", this.refresh);
		this.events.subscribe("ACTION_RING_CONTENTS_CHANGED", this.refreshContents);
		this.events.subscribe("ACTION_BAR_CURSOR_CHANGED", this.syncNative);
		this.events.subscribe("COMBAT_ENDED", this.reconcile);
		this.reconcile();
	}
	shutdown(): void {
		this.wanted = false;
		this.events.unsubscribe("ACTION_BAR_CHANGED", this.refresh);
		this.events.unsubscribe(
			"ACTION_RING_CONTENTS_CHANGED",
			this.refreshContents,
		);
		this.events.unsubscribe("ACTION_BAR_CURSOR_CHANGED", this.syncNative);
		this.reconcile();
	}
}
