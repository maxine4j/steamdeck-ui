import type {
	EquipmentSlot,
	IEquipmentActions,
} from "../../clients/character-client";
import type { IModal, ModalOption } from "../../ui/components/modal";

export interface IEquipmentActionMenu {
	open(slot: EquipmentSlot): void;
	close(): void;
}
export class EquipmentActionMenu implements IEquipmentActionMenu {
	constructor(
		private readonly modal: IModal,
		private readonly actions: IEquipmentActions,
	) {}
	open(slot: EquipmentSlot): void {
		const substitutes = this.actions.getSubstitutes(slot);
		const showPage = (page: number): void => {
			const options: ModalOption[] = [];
			if (slot.itemId !== undefined)
				options.push({
					id: "unequip",
					label: "Unequip",
					select: () => this.actions.unequip(slot),
				});
			for (const item of substitutes.slice(page * 8, (page + 1) * 8)) {
				options.push({
					id: `equip-${item.location}`,
					label: item.name,
					select: () => this.actions.equipSubstitute(slot, item),
				});
			}
			if (page > 0)
				options.push({
					id: "previous",
					label: "Previous items",
					select: () => showPage(page - 1),
				});
			if ((page + 1) * 8 < substitutes.length)
				options.push({
					id: "next",
					label: "More items",
					select: () => showPage(page + 1),
				});
			options.push({
				id: "cancel",
				label: "Cancel",
				select: () => this.close(),
			});
			this.modal.open(
				`${slot.name} options`,
				options,
				slot.hyperlink ?? slot.itemId,
			);
		};
		showPage(0);
	}
	close(): void {
		this.modal.close();
	}
}
