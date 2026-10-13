import type { ICollectionsClient } from "../../clients/collections-client";
import type { IPetsClient } from "../../clients/pets-client";
import type { IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export class BuiltInPets {
	constructor(private readonly client: ICollectionsClient) {}
	disable(): void {
		this.client.disable("pets");
	}
	restore(): void {
		this.client.restore("pets");
	}
	isOpen(): boolean {
		return this.client.isOpen("pets");
	}
	close(): void {
		this.client.close();
	}
}
export class PetsModule implements IModule {
	readonly id = "pets";
	private readonly refresh = (payload?: { id: string }) => {
		this.journal.invalidate(payload?.id);
		this.view.invalidate();
	};
	private readonly resume = () => this.view.resume();
	private readonly sync = () => {
		if (this.native.isOpen()) this.ui.openPanel(this.id, "right");
		else this.ui.closePanel("right", this.id);
	};
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly view: { invalidate(): void; resume(): void },
		private readonly native: Pick<
			BuiltInPets,
			"disable" | "restore" | "isOpen"
		>,
		private readonly journal: Pick<
			IPetsClient,
			"prefetch" | "invalidate" | "stop"
		>,
	) {}
	disableBuiltIn(): void {
		this.native.disable();
	}
	initialize(): void {
		this.events.subscribe("COMBAT_ENDED", this.resume);
		this.events.subscribe("PETS_CHANGED", this.refresh);
		this.events.subscribe("PETS_VISIBILITY_CHANGED", this.sync);
		this.journal.prefetch();
		if (this.native.isOpen()) this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("COMBAT_ENDED", this.resume);
		this.events.unsubscribe("PETS_CHANGED", this.refresh);
		this.events.unsubscribe("PETS_VISIBILITY_CHANGED", this.sync);
		this.journal.stop();
		this.native.restore();
	}
}
