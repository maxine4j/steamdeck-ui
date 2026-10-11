import type { WowFrame } from "../../types";

declare global {
	const CollectionsJournal: WowFrame & {
		IsShown(): boolean;
		GetParent(): WowFrame | undefined;
		HookScript(
			script: "OnShow" | "OnHide",
			callback: (this: void) => void,
		): void;
	};
	const MountJournal: WowFrame & {
		IsShown(): boolean;
		GetParent(): WowFrame | undefined;
		HookScript(
			script: "OnShow" | "OnHide",
			callback: (this: void) => void,
		): void;
		BottomLeftInset: { SlotButton: { ApplyEquipmentAtCursor(): void } };
	};
}
