import type { ICharacterFrameClient } from "../../clients/character-frame-client";
export interface IBuiltInPaperDoll {
	disable(): void;
	restore(): void;
	isOpen(): boolean;
}
export class BuiltInPaperDoll implements IBuiltInPaperDoll {
	constructor(private readonly client: ICharacterFrameClient) {}
	disable(): void {
		this.client.enable(
			"PaperDollFrame",
			"CHARACTER_VISIBILITY_CHANGED",
			"left",
		);
	}
	restore(): void {
		this.client.disable("PaperDollFrame");
	}
	isOpen(): boolean {
		return this.client.isOpen("PaperDollFrame");
	}
}
