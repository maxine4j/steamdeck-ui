import { afterEach, expect, it, vi } from "vitest";
import { VendorClient } from "./vendor-client";

afterEach(() => vi.unstubAllGlobals());
function setup() {
	let money = 1000;
	let available = -1;
	const info = () => ({
		name: "Potion",
		texture: 2,
		price: 100,
		stackCount: 5,
		numAvailable: available,
		isPurchasable: true,
		isUsable: true,
		hasExtendedCost: true,
	});
	vi.stubGlobal("C_MerchantFrame", {
		GetItemInfo: info,
		GetNumJunkItems: () => 2,
		IsSellAllJunkEnabled: () => true,
		SellAllJunkItems: vi.fn(),
	});
	vi.stubGlobal("GetMerchantNumItems", () => 11);
	vi.stubGlobal("GetMerchantItemLink", (index: number) => `item:${index}`);
	vi.stubGlobal("GetMerchantItemCostInfo", () => 1);
	vi.stubGlobal("GetMerchantItemCostItem", () => [
		3,
		4,
		"currency:1",
		"Tokens",
	]);
	vi.stubGlobal("CanAffordMerchantItem", () => money >= 100);
	vi.stubGlobal("GetNumBuybackItems", () => 1);
	vi.stubGlobal("GetBuybackItemInfo", () => ["Sword", 4, 500, 1]);
	vi.stubGlobal("GetBuybackItemLink", () => "item:99");
	vi.stubGlobal("BuyMerchantItem", vi.fn());
	vi.stubGlobal("BuybackItem", vi.fn());
	vi.stubGlobal("CanMerchantRepair", () => true);
	vi.stubGlobal("GetRepairAllCost", () => [600, true]);
	vi.stubGlobal("GetMoney", () => money);
	vi.stubGlobal("CanGuildBankRepair", () => true);
	vi.stubGlobal("GetGuildBankWithdrawMoney", () => -1);
	vi.stubGlobal("GetGuildBankMoney", () => 1000);
	vi.stubGlobal("RepairAllItems", vi.fn());
	vi.stubGlobal("IsBagOpen", () => false);
	vi.stubGlobal("OpenAllBags", vi.fn());
	vi.stubGlobal("CloseMerchant", vi.fn());
	return {
		client: new VendorClient(),
		money: (value: number) => {
			money = value;
		},
		stock: (value: number) => {
			available = value;
		},
	};
}

it("maps vendor offers and buyback with prices, bundle sizes, stock and additional costs", () => {
	const { client } = setup();
	client.setOpen(true);
	expect(client.getItems()).toHaveLength(11);
	expect(client.getItems().at(0)).toMatchObject({
		index: 1,
		name: "Potion",
		count: 5,
		price: 100,
		available: -1,
		costs: [{ icon: 3, count: 4, label: "Tokens" }],
		purchasable: true,
	});
	expect(client.getBuyback()).toEqual([
		{
			index: 1,
			name: "Sword",
			icon: 4,
			price: 500,
			count: 1,
			available: 1,
			purchasable: true,
			hyperlink: "item:99",
			costs: [],
		},
	]);
});

it("revalidates purchases and buyback against the current merchant, stock, identity and money", () => {
	const { client, money, stock } = setup();
	client.setOpen(true);
	const item = client.getItems().at(0);
	const buyback = client.getBuyback().at(0);
	if (!item || !buyback) throw new Error("Expected merchant items");
	client.buy(item);
	expect(BuyMerchantItem).toHaveBeenCalledWith(1);
	stock(0);
	client.buy(item);
	expect(BuyMerchantItem).toHaveBeenCalledOnce();
	client.buyback(buyback);
	expect(BuybackItem).toHaveBeenCalledWith(1);
	money(0);
	client.buyback(buyback);
	expect(BuybackItem).toHaveBeenCalledOnce();
	client.setOpen(false);
	client.buyback(buyback);
	expect(client.getItems()).toEqual([]);
});

it("guards repair funds and junk actions, and ensures bags only open when needed", () => {
	const { client, money } = setup();
	client.setOpen(true);
	expect(client.getActions()).toEqual({
		repairCost: 600,
		repair: true,
		guildRepair: true,
		sellJunk: true,
	});
	client.repair(false);
	expect(RepairAllItems).toHaveBeenCalledWith(false);
	money(0);
	client.repair(false);
	expect(RepairAllItems).toHaveBeenCalledOnce();
	client.repair(true);
	expect(RepairAllItems).toHaveBeenLastCalledWith(true);
	client.sellJunk();
	expect(C_MerchantFrame.SellAllJunkItems).toHaveBeenCalledOnce();
	client.ensureBagsOpen();
	expect(OpenAllBags).toHaveBeenCalledOnce();
	vi.stubGlobal("IsBagOpen", () => true);
	client.ensureBagsOpen();
	expect(OpenAllBags).toHaveBeenCalledOnce();
	client.setOpen(false);
	client.sellJunk();
	expect(C_MerchantFrame.SellAllJunkItems).toHaveBeenCalledOnce();
});
