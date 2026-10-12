// Blizzard FrameXML EquipmentManager.lua and the PaperDollFrame item flyout.
// These UI helpers are outside the generated WoW API declarations.
interface NativeEquipmentAction {
	invSlot: number;
}
declare function GetInventoryItemsForSlot(
	this: void,
	slot: number,
	items: Record<number, number>,
): void;
declare function EquipmentManager_GetLocationData(
	this: void,
	location: number,
): { isPlayer?: boolean; isBags?: boolean; slot?: number };
declare function EquipmentManager_GetItemInfoByLocation(
	this: void,
	location: number,
): LuaMultiReturn<
	[
		number | undefined,
		string | undefined,
		number | undefined,
		number | undefined,
		number | undefined,
		number | undefined,
		string | undefined,
		boolean | undefined,
	]
>;
declare function EquipmentManager_UnequipItemInSlot(
	this: void,
	slot: number,
): NativeEquipmentAction | undefined;
declare function EquipmentManager_EquipItemByLocation(
	this: void,
	location: number,
	slot: number,
): NativeEquipmentAction | undefined;
declare function EquipmentManager_RunAction(
	this: void,
	action: NativeEquipmentAction,
): void;
