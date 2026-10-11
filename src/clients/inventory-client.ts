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
export interface IInventoryClient {
	getItems(): InventoryItem[];
	getMoney(): number;
	isOpen(): boolean;
}
export class InventoryClient implements IInventoryClient {
	// Retail backpack, four equipped bags, and reagent bag; excludes banks.
	private readonly bagIds = [0, 1, 2, 3, 4, 5];
	private readonly requestedItems = new Set<number>();
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
