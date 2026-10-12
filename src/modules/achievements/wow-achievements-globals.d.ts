import type { WowFrame } from "../../types";

declare global {
	const AchievementFrame:
		| (WowFrame & {
				IsShown(): boolean;
				GetParent(): WowFrame | undefined;
				selectedTab: number;
				HookScript(
					script: "OnShow" | "OnHide",
					callback: (this: void) => void,
				): void;
		  })
		| undefined;
	function AchievementFrame_LoadUI(this: void): boolean;
}
