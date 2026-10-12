import type { IToysClient, Toy } from "../../clients/toys-client";
import type { IModal, ModalOption } from "../../ui/components/modal";

export interface IToyActionMenu {
	open(toy: Toy): void;
	close(): void;
}
export class ToyActionMenu implements IToyActionMenu {
	constructor(
		private readonly modal: IModal,
		private readonly client: Pick<IToysClient, "canUse" | "toggleFavourite">,
		private readonly refresh: () => void,
	) {}
	open(toy: Toy): void {
		const options: ModalOption[] = [];
		if (toy.collected && this.client.canUse(toy.id))
			options.push({ id: "use", label: "Use", toy: toy.id, select: () => {} });
		if (toy.collected)
			options.push({
				id: "favourite",
				label: toy.favourite ? "Unfavourite" : "Favourite",
				select: () => {
					this.client.toggleFavourite(toy.id);
					this.refresh();
				},
			});
		options.push({ id: "cancel", label: "Cancel", select: () => this.close() });
		this.modal.open("Toy actions", options, toy.id);
	}
	close(): void {
		this.modal.close();
	}
}
