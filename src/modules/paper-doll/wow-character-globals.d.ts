import type { WowFrame } from "../../types";

/** FrameXML and legacy inventory contracts absent from generated API documentation. */
declare global {
	const CharacterFrame: WowFrame & {
		GetParent(): WowFrame | undefined;
		IsShown(): boolean;
		activeSubframe?: string;
	};
	function ToggleCharacter(this: void, tab: string, onlyShow?: boolean): void;
	function HideUIPanel(this: void, frame: WowFrame): void;
	function hooksecurefunc(
		this: void,
		target: typeof CharacterFrame,
		method: string,
		callback: (this: void) => void,
	): void;
	function GetInventoryItemID(
		this: void,
		unit: string,
		slot: number,
	): number | undefined;
	function GetInventoryItemLink(
		this: void,
		unit: string,
		slot: number,
	): string | undefined;
	function GetInventoryItemTexture(
		this: void,
		unit: string,
		slot: number,
	): number | undefined;
	function GetInventoryItemQuality(
		this: void,
		unit: string,
		slot: number,
	): number | undefined;
	function IsInventoryItemLocked(this: void, slot: number): boolean;
	function PickupInventoryItem(this: void, slot: number): void;
	function UseInventoryItem(this: void, slot: number): void;
	function GetAverageItemLevel(
		this: void,
	): LuaMultiReturn<[number, number, number]>;
}
