import type { WowFrame } from "../../types";

declare global {
	const PlayerSpellsFrame:
		| (WowFrame & {
				IsShown(): boolean;
				IsInspecting(): boolean;
				GetParent(): WowFrame | undefined;
				GetTab(): number;
				readonly specTabID: number;
				readonly talentTabID: number;
				readonly TalentsFrame: { RefreshLoadoutOptions(): void };
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
}
