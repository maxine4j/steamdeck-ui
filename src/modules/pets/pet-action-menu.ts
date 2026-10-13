import type { IPetsClient, Pet } from "../../clients/pets-client";
import { menuIcons } from "../../ui/components/menu-icons";
import type { IModal, ModalOption } from "../../ui/components/modal";

export interface IPetActionMenu {
	open(pet: Pet): void;
	close(): void;
}
export class PetActionMenu implements IPetActionMenu {
	constructor(
		private readonly modal: IModal,
		private readonly client: Pick<
			IPetsClient,
			"canUse" | "summon" | "toggleFavourite"
		>,
		private readonly refresh: () => void,
	) {}
	open(pet: Pet): void {
		const options: ModalOption[] = [];
		if (pet.collected && this.client.canUse(pet.id))
			options.push({
				id: "summon",
				label: `|T${pet.icon}:18:18|t Summon`,
				select: () => this.client.summon(pet.id),
			});
		if (pet.collected)
			options.push({
				id: "favourite",
				label: pet.favourite
					? `${menuIcons.remove} Unfavourite`
					: `${menuIcons.favourite} Favourite`,
				select: () => {
					this.client.toggleFavourite(pet.id);
					this.refresh();
				},
			});
		options.push({
			id: "cancel",
			label: `${menuIcons.cancel} Cancel`,
			select: () => this.close(),
		});
		this.modal.open("Pet actions", options, { text: pet.name });
	}
	close(): void {
		this.modal.close();
	}
}
