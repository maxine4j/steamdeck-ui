export interface VendorCost {
	readonly icon: number;
	readonly count: number;
	readonly label: string;
}
export interface VendorItem {
	readonly index: number;
	readonly name: string;
	readonly icon: number;
	readonly price: number;
	readonly count: number;
	readonly available: number;
	readonly purchasable: boolean;
	readonly hyperlink?: string;
	readonly costs: readonly VendorCost[];
}
export interface VendorActions {
	readonly repairCost: number;
	readonly repair: boolean;
	readonly guildRepair: boolean;
	readonly sellJunk: boolean;
}
export interface IVendorClient {
	setOpen(open: boolean): void;
	getItems(): VendorItem[];
	getBuyback(): VendorItem[];
	getActions(): VendorActions;
	buy(item: VendorItem): void;
	buyback(item: VendorItem): void;
	repair(guild: boolean): void;
	sellJunk(): void;
	ensureBagsOpen(): void;
	close(): void;
}
/** Merchant API conversion and action validation. No native frame dependencies. */
export class VendorClient implements IVendorClient {
	private open = false;
	setOpen(open: boolean): void {
		this.open = open;
	}
	private info(index: number): MerchantItemInfo | undefined {
		// Generated GetItemInfo incorrectly describes the documented table return as number.
		const getInfo = C_MerchantFrame.GetItemInfo as unknown as (
			this: void,
			index: number,
		) => MerchantItemInfo | undefined;
		return getInfo(index);
	}
	getItems(): VendorItem[] {
		if (!this.open) return [];
		const items: VendorItem[] = [];
		for (let index = 1; index <= GetMerchantNumItems(); index++) {
			const info = this.info(index);
			if (!info) continue;
			const costs: VendorCost[] = [];
			if (info.hasExtendedCost)
				for (let cost = 1; cost <= GetMerchantItemCostInfo(index); cost++) {
					const [icon, count, link, name] = GetMerchantItemCostItem(
						index,
						cost,
					);
					if (icon !== undefined)
						costs.push({ icon, count, label: name ?? link ?? "Item" });
				}
			items.push({
				index,
				name: info.name,
				icon: info.texture,
				price: info.price,
				count: info.stackCount,
				available: info.numAvailable,
				purchasable:
					info.isPurchasable &&
					info.numAvailable !== 0 &&
					CanAffordMerchantItem(index),
				hyperlink: GetMerchantItemLink(index),
				costs,
			});
		}
		return items;
	}
	getBuyback(): VendorItem[] {
		if (!this.open) return [];
		const items: VendorItem[] = [];
		for (let index = 1; index <= GetNumBuybackItems(); index++) {
			const [name, icon, price, count] = GetBuybackItemInfo(index);
			if (name)
				items.push({
					index,
					name,
					icon,
					price,
					count,
					available: 1,
					purchasable: GetMoney() >= price,
					hyperlink: GetBuybackItemLink(index),
					costs: [],
				});
		}
		return items;
	}
	getActions(): VendorActions {
		if (!this.open)
			return {
				repairCost: 0,
				repair: false,
				guildRepair: false,
				sellJunk: false,
			};
		let repairCost = 0;
		let needed = false;
		if (CanMerchantRepair()) [repairCost, needed] = GetRepairAllCost();
		const canRepair = needed && repairCost > 0;
		const limit =
			canRepair && CanGuildBankRepair() ? GetGuildBankWithdrawMoney() : 0;
		return {
			repairCost,
			repair: canRepair && GetMoney() >= repairCost,
			guildRepair:
				canRepair &&
				(limit === -1 || limit >= repairCost) &&
				GetGuildBankMoney() >= repairCost,
			sellJunk:
				this.open &&
				C_MerchantFrame.IsSellAllJunkEnabled() &&
				C_MerchantFrame.GetNumJunkItems() > 0,
		};
	}
	buy(item: VendorItem): void {
		if (!this.open || item.index < 1 || item.index > GetMerchantNumItems())
			return;
		const current = this.info(item.index);
		if (
			current?.isPurchasable &&
			current.numAvailable !== 0 &&
			current.name === item.name &&
			GetMerchantItemLink(item.index) === item.hyperlink &&
			CanAffordMerchantItem(item.index)
		)
			BuyMerchantItem(item.index);
	}
	buyback(item: VendorItem): void {
		if (!this.open || item.index < 1 || item.index > GetNumBuybackItems())
			return;
		const [name, , price] = GetBuybackItemInfo(item.index);
		if (
			name === item.name &&
			GetBuybackItemLink(item.index) === item.hyperlink &&
			GetMoney() >= price
		)
			BuybackItem(item.index);
	}
	repair(guild: boolean): void {
		const actions = this.getActions();
		if (guild ? actions.guildRepair : actions.repair) RepairAllItems(guild);
	}
	sellJunk(): void {
		if (this.getActions().sellJunk) C_MerchantFrame.SellAllJunkItems();
	}
	ensureBagsOpen(): void {
		if (![0, 1, 2, 3, 4, 5].some((bag) => IsBagOpen(bag))) OpenAllBags();
	}
	close(): void {
		if (this.open) {
			this.open = false;
			CloseMerchant();
		}
	}
}
