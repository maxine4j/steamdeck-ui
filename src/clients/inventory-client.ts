export interface InventoryItem {
	readonly bagId: number;
	readonly slotId: number;
	readonly itemId: number;
	readonly iconFileId: number;
}
export interface IInventoryClient {
	getItems(): InventoryItem[];
	isOpen(): boolean;
}
export class InventoryClient implements IInventoryClient {
	// Retail backpack, four equipped bags, and reagent bag; excludes banks.
	private readonly bagIds = [0, 1, 2, 3, 4, 5];
	isOpen(): boolean {
		return this.bagIds.some((bagId) => IsBagOpen(bagId));
	}
	getItems(): InventoryItem[] {
		const items: InventoryItem[] = [];
		for (const bagId of this.bagIds) {
			const slots = C_Container.GetContainerNumSlots(bagId);
			for (let slotId = 1; slotId <= slots; slotId++) {
				const item = C_Container.GetContainerItemInfo(bagId, slotId);
				if (item)
					items.push({
						bagId,
						slotId,
						itemId: item.itemID,
						iconFileId: item.iconFileID,
					});
			}
		}
		return items;
	}
}
