import type {
	BankKind,
	IBankClient,
	MoneyDirection,
} from "../../clients/bank-client";
import type { IModal, ModalOption } from "../../ui/components/modal";
import { formatMoney } from "../bags/bag-display";

export class BankOptions {
	constructor(
		private readonly modal: IModal,
		private readonly client: IBankClient,
	) {}
	purchase(kind: BankKind): void {
		const state = this.client.getState(kind);
		const cost = state.nextTabCost;
		if (!state.canBuyTab || cost === undefined) return;
		this.modal.open(
			`Buy next ${kind === "warband" ? "warband" : "bank"} tab?`,
			[
				{ id: "cancel", label: "Cancel", select: () => this.close() },
				{
					id: "confirm",
					label: `Buy for ${formatMoney(cost)}`,
					select: () => this.client.purchaseTab(kind, cost),
				},
			],
		);
	}
	transfer(direction: MoneyDirection): void {
		const state = this.client.getState("warband");
		const balance =
			direction === "deposit" ? state.characterMoney : state.money;
		if (
			balance <= 0 ||
			!(direction === "deposit" ? state.canDeposit : state.canWithdraw)
		)
			return;
		const verb = direction === "deposit" ? "Deposit" : "Withdraw";
		// Preserve three fixed denominations while lowering the scale for smaller balances.
		let scale = 100000000;
		while (scale * 50 > balance && scale > 1)
			scale = Math.max(1, Math.floor(scale / 10));
		const options: ModalOption[] = [1, 10, 50].map(
			(factor, index): ModalOption => {
				const amount = Math.min(balance, factor * scale);
				return {
					id: `amount-${index}`,
					label: `${verb} ${formatMoney(amount)}`,
					select: () => this.client.transferMoney(direction, amount),
				};
			},
		);
		const reserve = 100000 * 10000;
		if (balance > reserve)
			options.push({
				id: "reserve",
				label: `${verb} all but 100,000 gold`,
				select: () => this.client.transferMoney(direction, balance - reserve),
			});
		options.push({
			id: "all",
			label:
				direction === "deposit"
					? "Deposit all character gold"
					: "Withdraw all warband gold",
			select: () => this.client.transferMoney(direction, balance),
		});
		options.push({ id: "cancel", label: "Cancel", select: () => this.close() });
		this.modal.open(`${verb} gold`, options);
	}
	close(): void {
		this.modal.close();
	}
}
