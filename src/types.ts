/** Narrow native contracts used only by frame adapters. Methods use Lua self. */
export interface WowTexture {
	SetTexture(fileId: number | undefined): void;
	SetAllPoints(): void;
	SetColorTexture(
		red: number,
		green: number,
		blue: number,
		alpha: number,
	): void;
}
export interface WowFrame {
	Show(): void;
	Hide(): void;
	SetParent(parent?: WowFrame): void;
	ClearAllPoints(): void;
	SetPoint(
		point: string,
		relativeTo?: WowFrame,
		relativePoint?: string,
		x?: number,
		y?: number,
	): void;
	SetSize(width: number, height: number): void;
	CreateTexture(name?: string, layer?: string): WowTexture;
}

export interface WowEventFrame extends WowFrame {
	RegisterEvent(event: string): void;
	SetScript(
		script: "OnEvent",
		handler: (this: void, frame: WowEventFrame, event: string) => void,
	): void;
}

/** UI-object APIs are absent from the generated game API declarations. */
declare global {
	const UIParent: WowFrame;
	function CreateFrame(
		this: void,
		type: string,
		name?: string,
		parent?: WowFrame,
	): WowEventFrame;
}
