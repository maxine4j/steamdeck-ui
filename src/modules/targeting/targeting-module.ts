import type { ITargetingClient } from "../../clients/targeting-client";
import type { ScreenPlus } from "../../ui/components/screen-plus";
import type { IModule } from "../types";

export class TargetingModule implements IModule {
	readonly id = "targeting";
	constructor(
		private readonly view: Pick<ScreenPlus, "show" | "destroy">,
		private readonly client: ITargetingClient,
	) {}
	disableBuiltIn(): void {}
	initialize(): void {
		this.view.show(14, [1, 0.82, 0.2], () => this.client.getPosition());
	}
	shutdown(): void {
		this.view.destroy();
	}
}
