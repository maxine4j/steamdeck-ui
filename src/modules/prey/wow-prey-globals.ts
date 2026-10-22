import type { NativeDialogFrame } from "../../ui/components/native-dialog-navigation";
import type { NativeNavigationFrame } from "../../ui/components/native-navigation";

/** Blizzard_AdventureMap and Blizzard_CovenantMissionUI, Retail. */
export interface PreyMapPin extends NativeNavigationFrame {
	questID: number;
	IsVisible(): boolean;
	GetGlobalPosition(): LuaMultiReturn<[number, number]>;
	OnClick(button: string): void;
	OnMouseEnter(): void;
	OnMouseLeave(): void;
}
export interface PreyMapFrame extends NativeDialogFrame {
	EnumeratePinsByTemplate(template: string): LuaIterable<PreyMapPin>;
}
export interface PreyGlobals {
	CovenantMissionFrame?: NativeDialogFrame & {
		MapTab: PreyMapFrame;
		CloseButton: NativeDialogFrame & { Click(button: string): void };
	};
	AdventureMapQuestChoiceDialog?: NativeDialogFrame & { DeclineQuest(): void };
}
