export interface InventoryItem {
	readonly bagId: number;
	readonly slotId: number;
	readonly itemId: number;
	readonly iconFileId: number;
	readonly count: number;
	readonly quality: number;
	readonly category: ItemCategory;
	readonly expansionId?: number;
	readonly itemLevel?: number;
	readonly stackable: boolean;
	readonly hyperlink?: string;
}
export type ItemCategory =
	| "Equipment"
	| "Reagents"
	| "Consumables"
	| "Quest"
	| "Recipes"
	| "Junk"
	| "Miscellaneous";
export type InventorySlot = Pick<
	InventoryItem,
	"bagId" | "slotId" | "itemId" | "hyperlink"
>;
export interface IInventoryActions {
	useItem(item: InventorySlot): void;
	pickupItem(item: InventorySlot): void;
}
export interface IInventoryClient extends IInventoryActions {
	getItems(): InventoryItem[];
	getMoney(): number;
	isOpen(): boolean;
}
export class InventoryClient implements IInventoryClient {
	// Retail backpack, four equipped bags, and reagent bag; excludes banks.
	private readonly bagIds = [0, 1, 2, 3, 4, 5];
	private readonly requestedItems = new Set<number>();
	private isCurrentUnlockedSlot(item: InventorySlot): boolean {
		if (!this.bagIds.includes(item.bagId) || item.slotId < 1) return false;
		const current = C_Container.GetContainerItemInfo(item.bagId, item.slotId);
		return (
			current !== undefined &&
			!current.isLocked &&
			current.itemID === item.itemId &&
			(item.hyperlink === undefined || current.hyperlink === item.hyperlink)
		);
	}
	useItem(item: InventorySlot): void {
		if (!this.isCurrentUnlockedSlot(item)) return;
		// The generated signature incorrectly requires optional trailing arguments.
		const use = C_Container.UseContainerItem as unknown as (
			this: void,
			bag: number,
			slot: number,
		) => void;
		use(item.bagId, item.slotId);
	}
	pickupItem(item: InventorySlot): void {
		if (CursorHasItem() || !this.isCurrentUnlockedSlot(item)) return;
		// Pick up exactly one physical stack. The world drop owns deletion confirmation.
		C_Container.PickupContainerItem(item.bagId, item.slotId);
	}
	getMoney(): number {
		return GetMoney();
	}
	isOpen(): boolean {
		return this.bagIds.some((bagId) => IsBagOpen(bagId));
	}
	getItems(): InventoryItem[] {
		const items: InventoryItem[] = [];
		for (const bagId of this.bagIds) {
			const slots = C_Container.GetContainerNumSlots(bagId);
			for (let slotId = 1; slotId <= slots; slotId++) {
				const item = C_Container.GetContainerItemInfo(bagId, slotId);
				if (item) {
					const [
						name,
						,
						quality,
						,
						,
						,
						,
						maxStack,
						,
						,
						,
						,
						,
						,
						expansionId,
						,
						reagent,
					] = C_Item.GetItemInfo(item.itemID);
					const [, , , equipLoc, , classId] = C_Item.GetItemInfoInstant(
						item.itemID,
					);
					const loaded = name !== undefined && name !== "";
					if (!loaded && !this.requestedItems.has(item.itemID)) {
						this.requestedItems.add(item.itemID);
						C_Item.RequestLoadItemDataByID(item.itemID);
					}
					const equipment =
						(classId === 2 || classId === 4) &&
						equipLoc !== undefined &&
						equipLoc !== "" &&
						equipLoc !== "INVTYPE_BAG" &&
						equipLoc !== "INVTYPE_NON_EQUIP_IGNORE";
					// The generated ItemInfo alias omits the API's supported hyperlink input.
					const getLevel = C_Item.GetDetailedItemLevelInfo as unknown as (
						this: void,
						info: number | string,
					) => LuaMultiReturn<[number, boolean, number]>;
					let level = 0;
					if (equipment)
						[level] = getLevel(
							item.hyperlink !== undefined && item.hyperlink !== ""
								? item.hyperlink
								: item.itemID,
						);
					items.push({
						bagId,
						slotId,
						itemId: item.itemID,
						iconFileId: item.iconFileID,
						count: item.stackCount ?? 1,
						quality: item.quality ?? quality ?? 1,
						category:
							(item.quality ?? quality) === 0
								? "Junk"
								: equipment
									? "Equipment"
									: reagent || classId === 7
										? "Reagents"
										: classId === 0
											? "Consumables"
											: classId === 12
												? "Quest"
												: classId === 9
													? "Recipes"
													: "Miscellaneous",
						expansionId: loaded ? expansionId : undefined,
						itemLevel: equipment && (level ?? 0) > 1 ? level : undefined,
						stackable: (maxStack ?? 1) > 1,
						hyperlink: item.hyperlink,
					});
				}
			}
		}
		return items;
	}
}
