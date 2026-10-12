import type { ICharacterFrameClient } from "../../clients/character-frame-client";
export interface IBuiltInReputation {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
	isCharacterOpen(): boolean;
}
export class BuiltInReputation implements IBuiltInReputation {
	constructor(private readonly client: ICharacterFrameClient) {}
	disable(): void {
		this.client.enable("ReputationFrame", "REPUTATION_VISIBILITY_CHANGED");
	}
	restore(): void {
		this.client.disable("ReputationFrame");
	}
	isOpen(): boolean {
		return this.client.isOpen("ReputationFrame");
	}
	isCharacterOpen(): boolean {
		return this.client.isOpen();
	}
	open(): void {
		this.client.open("ReputationFrame");
	}
	close(): void {
		this.client.close();
	}
}
