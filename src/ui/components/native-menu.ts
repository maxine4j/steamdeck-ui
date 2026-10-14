import type { WowFrame } from "../../types";

export interface NativeMenuDescription {
	AddInitializer(initialize: (this: void, frame: WowFrame) => void): void;
	HandleOnEnter(frame: WowFrame): void;
	HandleOnLeave(frame: WowFrame): void;
	Pick(context: number, button: string): void;
}

export interface NativeMenuRoot {
	CreateCheckbox(
		label: string,
		checked: (this: void) => boolean,
		respond: (this: void) => number,
	): NativeMenuDescription;
	CreateRadio(
		label: string,
		selected: (this: void) => boolean,
		respond: (this: void) => number,
	): NativeMenuDescription;
	CreateButton(
		label: string,
		respond: (this: void) => number,
	): NativeMenuDescription;
}

export interface NativeDropdownButton extends WowFrame {
	resizeToText: boolean;
	SetupMenu(
		generate: (
			this: void,
			button: NativeDropdownButton,
			root: NativeMenuRoot,
		) => void,
	): void;
	RegisterCallback(
		event: string,
		callback: (this: void) => void,
		owner: object,
	): void;
	UnregisterCallback(event: string, owner: object): void;
	IsMenuOpen(): boolean;
	SetMenuOpen(open: boolean): void;
	CloseMenu(): void;
	ClearMenuState(): void;
}
