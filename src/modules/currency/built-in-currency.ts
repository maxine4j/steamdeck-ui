import type { ICharacterFrameClient } from "../../clients/character-frame-client";
export interface IBuiltInCurrency {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class BuiltInCurrency implements IBuiltInCurrency {
	constructor(private readonly client: ICharacterFrameClient) {}
	disable(): void {
		this.client.enable("TokenFrame", "CURRENCY_VISIBILITY_CHANGED");
	}
	restore(): void {
		this.client.disable("TokenFrame");
	}
	isOpen(): boolean {
		return this.client.isOpen("TokenFrame");
	}
	open(): void {
		this.client.open("TokenFrame");
	}
	close(): void {
		this.client.close();
	}
}
