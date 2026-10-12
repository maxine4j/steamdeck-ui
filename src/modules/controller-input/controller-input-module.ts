import type { IControllerInputClient } from "../../clients/controller-input-client";
import type { IModule } from "../types";

/** Configures native controller input without owning any panel content. */
export class ControllerInputModule implements IModule {
	readonly id = "controller-input";
	constructor(private readonly client: IControllerInputClient) {}
	disableBuiltIn(): void {
		this.client.disableBuiltIn();
	}
	initialize(): void {
		this.client.initialize();
	}
	shutdown(): void {
		this.client.shutdown();
	}
}
