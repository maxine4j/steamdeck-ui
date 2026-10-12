import type { IMountsClient, Mount } from "../../clients/mounts-client";
import { menuIcons } from "../../ui/components/menu-icons";
import type { IModal, ModalOption } from "../../ui/components/modal";

export interface IMountActionMenu {
	open(mount: Mount): void;
	close(): void;
}

export class MountActionMenu implements IMountActionMenu {
	constructor(
		private readonly modal: IModal,
		private readonly client: Pick<IMountsClient, "summon" | "canUse">,
		private readonly toggleFavourite: (id: number) => void,
	) {}
	open(mount: Mount): void {
		const options: ModalOption[] = [];
		if (mount.collected && this.client.canUse(mount.id))
			options.push({
				id: "use",
				label: `|T${mount.icon}:18:18|t Use`,
				select: () => this.client.summon(mount.id),
			});
		if (mount.collected)
			options.push({
				id: "favourite",
				label: mount.favourite
					? `${menuIcons.remove} Unfavourite`
					: `${menuIcons.favourite} Favourite`,
				select: () => this.toggleFavourite(mount.id),
			});
		options.push({
			id: "cancel",
			label: `${menuIcons.cancel} Cancel`,
			select: () => this.close(),
		});
		this.modal.open("Mount actions", options, { mountSpell: mount.spell });
	}
	close(): void {
		this.modal.close();
	}
}
