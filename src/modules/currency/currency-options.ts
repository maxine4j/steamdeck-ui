import type {
	Currency,
	CurrencySource,
	ICurrencyClient,
} from "../../clients/currency-client";
import type { IModal, ModalOption } from "../../ui/components/modal";

export class CurrencyOptions {
	private awaitingTransfer = false;
	transferResult(success: boolean): void {
		if (!this.awaitingTransfer) return;
		this.awaitingTransfer = false;
		this.message(
			success
				? "Currency transferred"
				: "Transfer failed — try again when available",
		);
	}
	constructor(
		private readonly modal: IModal,
		private readonly client: ICurrencyClient,
		private readonly changed: () => void,
	) {}
	close(): void {
		this.awaitingTransfer = false;
		this.modal.close();
	}
	private message(title: string): void {
		this.modal.open(title, [
			{ id: "close", label: "Close", select: () => this.close() },
		]);
	}
	open(currency: Currency): void {
		const options: ModalOption[] = [];
		if (currency.discovered)
			options.push({
				id: "watch",
				label: currency.watched ? "Unwatch in backpack" : "Watch in backpack",
				select: () => {
					if (!this.client.setWatched(currency.id, !currency.watched))
						this.message(
							"Watch limit reached — unwatch another currency first",
						);
					this.changed();
				},
			});
		options.push({
			id: "unused",
			label: currency.unused ? "Mark active" : "Mark inactive",
			select: () => {
				this.client.setUnused(currency.id, !currency.unused);
				this.changed();
			},
		});
		if (currency.transferable)
			options.push({
				id: "transfer",
				label: "Transfer from another character…",
				select: () => {
					this.client.requestSources();
					this.sources(currency);
				},
			});
		options.push({ id: "cancel", label: "Cancel", select: () => this.close() });
		this.modal.open(
			`${currency.name} • ${currency.quantity}${currency.maximum > 0 ? ` / ${currency.maximum}` : ""}`,
			options,
			undefined,
			"left",
		);
	}
	private sources(currency: Currency, offset = 0): void {
		if (!this.client.sourcesReady()) {
			this.modal.open("Loading account currencies…", [
				{
					id: "retry",
					label: "Check again",
					select: () => this.sources(currency),
				},
				{ id: "cancel", label: "Cancel", select: () => this.close() },
			]);
			return;
		}
		const sources = this.client.getSources(currency.id);
		if (!sources.length) {
			this.message("No transfers available (balance, limits or eligibility)");
			return;
		}
		const options = sources
			.slice(offset, offset + 6)
			.map<ModalOption>((source) => ({
				id: source.guid,
				label: `${source.name} • Up to ${source.maximum}`,
				select: () => this.amounts(currency, source),
			}));
		if (offset > 0)
			options.push({
				id: "previous",
				label: "Previous characters",
				select: () => this.sources(currency, offset - 6),
			});
		if (offset + 6 < sources.length)
			options.push({
				id: "next",
				label: "More characters",
				select: () => this.sources(currency, offset + 6),
			});
		options.push({ id: "cancel", label: "Cancel", select: () => this.close() });
		this.modal.open(`Transfer ${currency.name} from…`, options);
	}
	private amounts(currency: Currency, source: CurrencySource): void {
		const amounts = [1, 10, 100, 1000].filter(
			(amount) => amount < source.maximum,
		);
		amounts.push(source.maximum);
		this.modal.open(`Receive ${currency.name}`, [
			...amounts.map<ModalOption>((amount) => ({
				id: `amount-${amount}`,
				label: `${amount}${amount === source.maximum ? " (maximum)" : ""}`,
				select: () => this.confirm(currency, source, amount),
			})),
			{ id: "cancel", label: "Cancel", select: () => this.close() },
		]);
	}
	private confirm(
		currency: Currency,
		source: CurrencySource,
		amount: number,
	): void {
		const cost = this.client.transferCost(currency.id, amount);
		if (cost === undefined) {
			this.message("Transfer unavailable");
			return;
		}
		this.modal.open(`${source.name}: Receive ${amount} • Costs ${cost}`, [
			{ id: "cancel", label: "Cancel", select: () => this.close() },
			{
				id: "confirm",
				label: "Confirm transfer",
				select: () => {
					if (!this.client.transfer(currency.id, source.guid, amount))
						this.message(
							"Transfer unavailable — balances or eligibility changed",
						);
					else this.awaitingTransfer = true;
					this.changed();
				},
			},
		]);
	}
}
