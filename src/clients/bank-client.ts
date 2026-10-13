import {
	ContainerItemReader,
	type IInventoryActions,
	type InventoryItem,
	type InventorySlot,
} from "./inventory-client";

export type BankKind = "standard" | "warband";
export type MoneyDirection = "deposit" | "withdraw";
export interface BankState {
	readonly available: boolean;
	readonly unlockedTabs: number;
	readonly maxTabs: number;
	readonly nextTabCost?: number;
	readonly canBuyTab: boolean;
	readonly money: number;
	readonly characterMoney: number;
	readonly canDeposit: boolean;
	readonly canWithdraw: boolean;
}
export interface IBankClient
	extends Pick<IInventoryActions, "useItem" | "pickupItem"> {
	setOpen(open: boolean): void;
	select(kind: BankKind): void;
	getDepositBankType(): number | undefined;
	getItems(kind: BankKind): InventoryItem[];
	getState(kind: BankKind): BankState;
	purchaseTab(kind: BankKind, expectedCost: number): void;
	transferMoney(direction: MoneyDirection, amount: number): void;
	close(): void;
}
export class BankClient implements IBankClient {
	private open = false;
	private selected: BankKind = "standard";
	private readonly reader = new ContainerItemReader();
	private bankType(kind: BankKind): number {
		return kind === "standard" ? 0 : 2;
	}
	setOpen(open: boolean): void {
		this.open = open;
	}
	select(kind: BankKind): void {
		this.selected = kind;
	}
	getDepositBankType(): number | undefined {
		return this.open ? this.bankType(this.selected) : undefined;
	}
	private tabIds(kind: BankKind): readonly number[] {
		// Generated declarations flatten API tables to numbers; FrameXML consumes an array.
		const fetch = C_Bank.FetchPurchasedBankTabIDs as unknown as (
			this: void,
			bankType: number,
		) => number[] | undefined;
		return fetch(this.bankType(kind)) ?? [];
	}
	getItems(kind: BankKind): InventoryItem[] {
		if (!this.open || !C_Bank.CanViewBank(this.bankType(kind))) return [];
		return this.reader.getItems(this.tabIds(kind));
	}
	getState(kind: BankKind): BankState {
		const type = this.bankType(kind);
		const available = this.open && C_Bank.CanViewBank(type);
		const usable = available && C_Bank.CanUseBank(type);
		const fetch = C_Bank.FetchNextPurchasableBankTabData as unknown as (
			this: void,
			bankType: number,
		) => C_Bank.PurchasableBankTabData | undefined;
		const next = available ? fetch(type) : undefined;
		const characterMoney = GetMoney();
		return {
			available,
			unlockedTabs: available ? C_Bank.FetchNumPurchasedBankTabs(type) : 0,
			maxTabs: kind === "standard" ? 6 : 5,
			nextTabCost: next?.tabCost,
			canBuyTab:
				usable &&
				next?.canAfford === true &&
				characterMoney >= next.tabCost &&
				C_Bank.CanPurchaseBankTab(type),
			money:
				available && kind === "warband" ? C_Bank.FetchDepositedMoney(type) : 0,
			characterMoney,
			canDeposit: usable && kind === "warband" && C_Bank.CanDepositMoney(type),
			canWithdraw:
				usable && kind === "warband" && C_Bank.CanWithdrawMoney(type),
		};
	}
	purchaseTab(kind: BankKind, expectedCost: number): void {
		if (InCombatLockdown()) return;
		const state = this.getState(kind);
		if (state.canBuyTab && state.nextTabCost === expectedCost)
			C_Bank.PurchaseBankTab(this.bankType(kind));
	}
	transferMoney(direction: MoneyDirection, amount: number): void {
		if (InCombatLockdown() || amount <= 0 || amount !== Math.floor(amount))
			return;
		const state = this.getState("warband");
		if (
			direction === "deposit" &&
			state.canDeposit &&
			amount <= state.characterMoney
		)
			C_Bank.DepositMoney(2, amount);
		if (direction === "withdraw" && state.canWithdraw && amount <= state.money)
			C_Bank.WithdrawMoney(2, amount);
	}
	private current(item: InventorySlot): boolean {
		if (!this.open || InCombatLockdown() || item.slotId < 1) return false;
		const kind = item.bagId >= 12 ? "warband" : "standard";
		if (
			!C_Bank.CanUseBank(this.bankType(kind)) ||
			!this.tabIds(kind).includes(item.bagId)
		)
			return false;
		const info = C_Container.GetContainerItemInfo(item.bagId, item.slotId);
		return (
			info !== undefined &&
			!info.isLocked &&
			info.itemID === item.itemId &&
			(item.hyperlink === undefined || info.hyperlink === item.hyperlink)
		);
	}
	useItem(item: InventorySlot): void {
		if (!this.current(item) || CursorHasItem()) return;
		const use = C_Container.UseContainerItem as unknown as (
			this: void,
			bag: number,
			slot: number,
		) => void;
		use(item.bagId, item.slotId);
	}
	pickupItem(item: InventorySlot): void {
		if (this.current(item) && !CursorHasItem())
			C_Container.PickupContainerItem(item.bagId, item.slotId);
	}
	close(): void {
		if (this.open) C_Bank.CloseBankFrame();
	}
}
