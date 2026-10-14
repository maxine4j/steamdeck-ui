import type { LayoutFrame } from "../../ui/components/native-layout";
import type { NativeNavigationFrame } from "../../ui/components/native-navigation";

export interface NativeTalentButton extends NativeNavigationFrame {
	IsVisible(): boolean;
	GetCenter(): LuaMultiReturn<[number | undefined, number | undefined]>;
	GetEffectiveScale(): number;
	GetNodeID?(): number;
	GetEntryID(): number;
	OnClick(button: string): void;
	readonly talentSelections?: number[];
	ShowSelections?(): void;
}

declare global {
	const PlayerSpellsFrame:
		| (LayoutFrame & {
				IsShown(): boolean;
				IsInspecting(): boolean;
				GetTab(): number;
				readonly specTabID: number;
				readonly talentTabID: number;
				readonly TalentsFrame: LayoutFrame & {
					RefreshLoadoutOptions(): void;
					EnumerateAllTalentButtons(): LuaIterable<NativeTalentButton>;
					HideSelections(): void;
					readonly HeroTalentsContainer: {
						readonly isCollapsed: boolean;
						SetCollapsed(collapsed: boolean, skipPersisting: boolean): void;
					};
					readonly SelectionChoiceFrame: {
						IsShown(): boolean;
						readonly selectionFrameArray: NativeTalentButton[];
						HookScript(
							script: "OnShow" | "OnHide",
							callback: (this: void) => void,
						): void;
					};
				};
				HookScript(
					script: "OnShow" | "OnHide",
					callback: (this: void) => void,
				): void;
		  })
		| undefined;
	function PlayerSpellsFrame_LoadUI(this: void): void;
	const PlayerSpellsUtil: {
		OpenToClassTalentsTab(this: void): void;
		OpenToClassSpecializationsTab(this: void): void;
	};
	const TalentDisplayMixin: {
		OnEnter(this: void, button: NativeTalentButton): void;
		OnLeave(this: void, button: NativeTalentButton): void;
	};
}
