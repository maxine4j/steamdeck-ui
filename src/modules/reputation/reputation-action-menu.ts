import type {
	IReputationClient,
	Reputation,
} from "../../clients/reputation-client";
import type { IModal, ModalOption } from "../../ui/components/modal";

export interface IReputationActionMenu {
	open(reputation: Reputation): void;
	close(): void;
}
export class ReputationActionMenu implements IReputationActionMenu {
	constructor(
		private readonly modal: IModal,
		private readonly client: Pick<
			IReputationClient,
			"activate" | "toggleAtWar" | "toggleInactive"
		>,
		private readonly refresh: () => void,
	) {}
	open(reputation: Reputation): void {
		const options: ModalOption[] = [];
		const add = (id: string, label: string, action: () => void) =>
			options.push({
				id,
				label,
				select: () => {
					action();
					this.refresh();
				},
			});
		if (reputation.hasReputation && !reputation.locked) {
			add(
				"track",
				reputation.watched ? "Stop tracking" : "Track reputation",
				() => this.client.activate(reputation),
			);
			if (
				!reputation.seasonal &&
				!reputation.header &&
				reputation.canToggleAtWar
			)
				add("war", reputation.atWar ? "Make peace" : "Declare war", () =>
					this.client.toggleAtWar(reputation),
				);
			if (!reputation.seasonal && reputation.canSetInactive)
				add(
					"inactive",
					reputation.inactive ? "Make active" : "Make inactive",
					() => this.client.toggleInactive(reputation),
				);
		}
		options.push({ id: "cancel", label: "Cancel", select: () => this.close() });
		this.modal.open(`${reputation.name} options`, options, {
			text: reputation.description,
		});
	}
	close(): void {
		this.modal.close();
	}
}
