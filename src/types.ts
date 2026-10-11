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
	CreateFontString(
		name?: string,
		layer?: string,
		template?: string,
	): WowFontString;
	SetScript(script: "OnClick", handler?: (this: void) => void): void;
	SetScript(
		script: "OnMouseWheel",
		handler?: (this: void, frame: WowFrame, delta: number) => void,
	): void;
	EnableMouseWheel(enabled: boolean): void;
	SetScrollChild(child?: WowFrame): void;
	GetVerticalScroll(): number;
	GetVerticalScrollRange(): number;
	SetVerticalScroll(offset: number): void;
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

export interface WowFontString {
	SetText(text: string): void;
	SetPoint(
		point: string,
		relativeTo: WowFrame,
		relativePoint: string,
		x: number,
		y: number,
	): void;
	ClearAllPoints(): void;
	SetFont(path: string, size: number, flags: string): void;
	SetJustifyH(justify: string): void;
	SetWidth(width: number): void;
}

export interface WowEventFrame extends WowFrame {
	RegisterEvent(event: string): void;
	SetScript(
		script: "OnEvent",
		handler: (this: void, frame: WowEventFrame, event: string) => void,
	): void;
	SetScript(script: "OnClick", handler?: (this: void) => void): void;
	SetScript(
		script: "OnMouseWheel",
		handler?: (this: void, frame: WowFrame, delta: number) => void,
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
