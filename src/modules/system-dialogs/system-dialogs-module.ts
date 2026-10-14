import type { INativeDialogsClient } from "../../clients/native-dialogs-client";
import type { IEventBus } from "../../events/types";
import type { IModalNavigation } from "../../ui/components/modal";
import type { IModule } from "../types";

export class SystemDialogsModule implements IModule {
	readonly id = "system-dialogs";
	private ids: string[] = [];
	private readonly refresh = () => {
		const dialogs = this.client.getDialogs();
		let shared = 0;
		while (
			shared < this.ids.length &&
			this.ids.at(shared) === dialogs.at(shared)?.id
		)
			shared++;
		for (let index = this.ids.length - 1; index >= shared; index--) {
			const id = this.ids.at(index);
			if (id) this.navigation.popModal(id);
		}
		this.ids = dialogs.map((dialog) => dialog.id);
		for (const dialog of dialogs)
			this.navigation.pushModal(dialog.id, dialog.grid, dialog.cancel);
	};
	constructor(
		private readonly client: INativeDialogsClient,
		private readonly events: IEventBus,
		private readonly navigation: IModalNavigation,
	) {}
	disableBuiltIn(): void {}
	initialize(): void {
		this.events.subscribe("NATIVE_DIALOGS_CHANGED", this.refresh);
		this.client.initialize();
		this.refresh();
	}
	shutdown(): void {
		this.events.unsubscribe("NATIVE_DIALOGS_CHANGED", this.refresh);
		for (const id of [...this.ids].reverse()) this.navigation.popModal(id);
		this.ids = [];
		this.client.shutdown();
	}
}
