import type { LayoutFrame } from "../../ui/components/native-layout";
import type { NativeNavigationFrame } from "../../ui/components/native-navigation";
import type { NativeVisibleRegion } from "../../ui/components/native-visibility";

export type TransmogScript = (
	this: void,
	frame: TransmogControl,
	button?: string,
) => void;
export interface TransmogControl extends NativeNavigationFrame {
	readonly menu?: TransmogControl;
	OpenMenu?(): void;
	CloseMenu?(): void;
	IsMenuOpen?(): boolean;
	GetChildren(): LuaMultiReturn<TransmogControl[]>;
	IsVisible(): boolean;
	IsObjectType(type: string): boolean;
	IsEnabled?(): boolean;
	IsProtected(): boolean;
	GetName(): string | undefined;
	GetCenter(): LuaMultiReturn<[number | undefined, number | undefined]>;
	GetEffectiveScale(): number;
	GetScript(script: string): TransmogScript | undefined;
	Click?(button: string): void;
	SetFocus?(): void;
	HookScript(script: string, callback: (this: void) => void): void;
}

declare global {
	const TransmogFrame:
		| (LayoutFrame &
				TransmogControl & {
					readonly NineSlice?: NativeVisibleRegion;
					readonly PortraitContainer?: NativeVisibleRegion;
					readonly TitleContainer?: NativeVisibleRegion;
					readonly CloseButton?: NativeVisibleRegion;
					readonly HelpPlateButton?: NativeVisibleRegion;
				})
		| undefined;
	const HelpPlate: { Hide(this: void, userToggled: boolean): void };
}
