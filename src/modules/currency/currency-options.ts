import type { IAddonConfigClient } from "../../clients/addon-config-client";
import type {
	Currency,
	CurrencySource,
	ICurrencyClient,
} from "../../clients/currency-client";
import { menuIcons } from "../../ui/components/menu-icons";
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
		private readonly config: IAddonConfigClient,
	) {}
	close(): void {
		this.awaitingTransfer = false;
		this.modal.close();
	}
	private message(title: string): void {
		this.modal.open(title, [
			{
				id: "close",
				label: `${menuIcons.cancel} Close`,
				select: () => this.close(),
			},
		]);
	}
	open(currency: Currency): void {
		const options: ModalOption[] = [];
		const favourite = this.config.getCurrencyFavourites().includes(currency.id);
		options.push({
			id: "favourite",
			label: favourite
				? `${menuIcons.remove} Remove from favourites`
				: `${menuIcons.favourite} Add to favourites`,
			select: () => {
				this.config.setCurrencyFavourite(currency.id, !favourite);
				this.changed();
			},
		});
		options.push({
			id: "unused",
			label: currency.unused
				? `${menuIcons.confirm} Mark active`
				: `${menuIcons.remove} Mark inactive`,
			select: () => {
				this.client.setUnused(currency.id, !currency.unused);
				this.changed();
			},
		});
		if (currency.transferable)
			options.push({
				id: "transfer",
				label: `${menuIcons.transfer} Transfer from another character…`,
				select: () => {
					this.client.requestSources();
					this.sources(currency);
				},
			});
		options.push({
			id: "cancel",
			label: `${menuIcons.cancel} Cancel`,
			select: () => this.close(),
		});
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
					label: `${menuIcons.retry} Check again`,
					select: () => this.sources(currency),
				},
				{
					id: "cancel",
					label: `${menuIcons.cancel} Cancel`,
					select: () => this.close(),
				},
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
				label: `${menuIcons.transfer} ${source.name} • Up to ${source.maximum}`,
				select: () => this.amounts(currency, source),
			}));
		if (offset > 0)
			options.push({
				id: "previous",
				label: `${menuIcons.previous} Previous characters`,
				select: () => this.sources(currency, offset - 6),
			});
		if (offset + 6 < sources.length)
			options.push({
				id: "next",
				label: `${menuIcons.next} More characters`,
				select: () => this.sources(currency, offset + 6),
			});
		options.push({
			id: "cancel",
			label: `${menuIcons.cancel} Cancel`,
			select: () => this.close(),
		});
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
				label: `${menuIcons.transfer} ${amount}${amount === source.maximum ? " (maximum)" : ""}`,
				select: () => this.confirm(currency, source, amount),
			})),
			{
				id: "cancel",
				label: `${menuIcons.cancel} Cancel`,
				select: () => this.close(),
			},
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
			{
				id: "cancel",
				label: `${menuIcons.cancel} Cancel`,
				select: () => this.close(),
			},
			{
				id: "confirm",
				label: `${menuIcons.confirm} Confirm transfer`,
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
