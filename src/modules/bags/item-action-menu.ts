import type {
	IInventoryActions,
	InventoryItem,
} from "../../clients/inventory-client";
import { menuIcons } from "../../ui/components/menu-icons";
import type { IModal } from "../../ui/components/modal";

export interface IItemActionMenu {
	open(item: InventoryItem): void;
	close(): void;
}

export class ItemActionMenu implements IItemActionMenu {
	constructor(
		private readonly modal: IModal,
		private readonly actions: IInventoryActions,
	) {}
	open(item: InventoryItem): void {
		this.modal.open(
			"Item actions",
			[
				{
					id: "use",
					label:
						item.category === "Equipment"
							? `${menuIcons.gear} Equip`
							: `|T${item.iconFileId}:18:18|t Use`,
					select: () => this.actions.useItem(item),
				},
				{
					id: "destroy",
					label: `${menuIcons.remove} Destroy…`,
					select: () => this.confirmDestroy(item),
				},
				{
					id: "cancel",
					label: `${menuIcons.cancel} Cancel`,
					select: () => this.close(),
				},
			],
			item.hyperlink ?? item.itemId,
		);
	}
	private confirmDestroy(item: InventoryItem): void {
		this.modal.open(
			`Destroy this stack (${item.count} items)?`,
			[
				{
					id: "cancel",
					label: `${menuIcons.cancel} Cancel`,
					select: () => this.close(),
				},
				{
					id: "confirm-destroy",
					label: `${menuIcons.remove} Destroy stack`,
					select: () => this.actions.destroyItem(item),
				},
			],
			item.hyperlink ?? item.itemId,
		);
	}
	close(): void {
		this.modal.close();
	}
}
