/** Narrow native contracts used only by frame adapters. Methods use Lua self. */
export interface WowTexture {
	ClearAllPoints(): void;
	SetPoint(
		point: string,
		relativeTo: WowFrame,
		relativePoint: string,
		x: number,
		y: number,
	): void;
	SetWidth(width: number): void;
	SetHeight(height: number): void;
	SetTexCoord(left: number, right: number, top: number, bottom: number): void;
	SetTexture(fileId: number | string | undefined): void;
	SetAllPoints(): void;
	SetColorTexture(
		red: number,
		green: number,
		blue: number,
		alpha: number,
	): void;
}
export interface WowLine {
	SetStartPoint(
		point: string,
		relativeTo: WowFrame,
		x: number,
		y: number,
	): void;
	SetEndPoint(point: string, relativeTo: WowFrame, x: number, y: number): void;
	SetThickness(thickness: number): void;
	SetColorTexture(
		red: number,
		green: number,
		blue: number,
		alpha: number,
	): void;
	ClearAllPoints(): void;
	Show(): void;
	Hide(): void;
}
export interface WowFrame {
	CreateLine(name?: string, layer?: string): WowLine;
	CreateFontString(
		name?: string,
		layer?: string,
		template?: string,
	): WowFontString;
	SetScript(
		script: "OnClick" | "OnDragStart" | "OnEnter" | "OnLeave",
		handler?: (this: void, frame: WowFrame, button: string) => void,
	): void;
	SetScript(
		script: "OnMouseWheel",
		handler?: (this: void, frame: WowFrame, delta: number) => void,
	): void;
	RegisterForClicks(...buttons: string[]): void;
	RegisterForDrag(...buttons: string[]): void;
	EnableMouseWheel(enabled: boolean): void;
	SetScrollChild(child?: WowFrame): void;
	GetVerticalScroll(): number;
	GetVerticalScrollRange(): number;
	SetVerticalScroll(offset: number): void;
	Show(): void;
	Hide(): void;
	SetParent(parent?: WowFrame): void;
	SetFrameStrata(
		strata: "PARENT" | "DIALOG" | "FULLSCREEN_DIALOG" | "TOOLTIP",
	): void;
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
	SetWordWrap(wrap: boolean): void;
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
		handler: (
			this: void,
			frame: WowEventFrame,
			event: string,
			...args: unknown[]
		) => void,
	): void;
	SetScript(
		script: "OnClick" | "OnDragStart" | "OnEnter" | "OnLeave",
		handler?: (this: void, frame: WowFrame, button: string) => void,
	): void;
	SetScript(
		script: "OnMouseWheel",
		handler?: (this: void, frame: WowFrame, delta: number) => void,
	): void;
}

/** UI-object APIs are absent from the generated game API declarations. */
declare global {
	const UISpecialFrames: string[];
	// Secure-frame guard is a global in the addon environment.
	function InCombatLockdown(this: void): boolean;
	const UIParent: WowFrame;
	const GameTooltip: {
		SetOwner(owner: WowFrame, anchor: string): void;
		SetHyperlink(link: string): void;
		SetText(text: string): void;
		Show(): void;
		Hide(): void;
	};
	function CreateFrame(
		this: void,
		type: string,
		name?: string,
		parent?: WowFrame,
		template?: string,
	): WowEventFrame;
}
