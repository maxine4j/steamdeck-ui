import type { ISlashCommandsClient } from "../../clients/slash-commands-client";
import type { IModule } from "../types";

export class SlashCommandsModule implements IModule {
	readonly id = "slash-commands";
	constructor(private readonly client: ISlashCommandsClient) {}
	disableBuiltIn(): void {}
	initialize(): void {
		this.client.initialize();
	}
	shutdown(): void {
		this.client.shutdown();
	}
}
