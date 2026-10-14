import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { AuctionHouseClient } from "./auction-house-client";

afterEach(() => vi.unstubAllGlobals());
const key = { itemID: 123, itemLevel: 0, itemSuffix: 0, battlePetSpeciesID: 0 };
function setup(commodity = true) {
	const api = {
		SearchForFavorites: vi.fn(),
		SendBrowseQuery: vi.fn(),
		SendSearchQuery: vi.fn(),
		IsThrottledMessageSystemReady: () => true,
		GetBrowseResults: () => [
			{ itemKey: key, minPrice: 100, totalQuantity: 80 },
		],
		GetItemKeyInfo: () => ({
			itemName: "Ore",
			iconFileID: 1,
			isCommodity: commodity,
		}),
		GetNumCommoditySearchResults: () => 2,
		GetCommoditySearchResultInfo: (_id: number, index: number) => ({
			quantity: index === 1 ? 5 : 75,
			unitPrice: index === 1 ? 100 : 200,
			numOwnerItems: 0,
		}),
		GetNumItemSearchResults: () => 3,
		GetItemSearchResultInfo: (_key: unknown, index: number) => ({
			auctionID: index,
			quantity: 1,
			buyoutAmount: index === 1 ? 0 : index * 100,
			containsOwnerItem: index === 3,
		}),
		StartCommoditiesPurchase: vi.fn(),
		ConfirmCommoditiesPurchase: vi.fn(),
		CancelCommoditiesPurchase: vi.fn(),
		GetQuoteDurationRemaining: () => 20,
		PlaceBid: vi.fn(),
		QueryOwnedAuctions: vi.fn(),
		GetNumOwnedAuctions: () => 1,
		GetOwnedAuctionInfo: () => ({
			auctionID: 99,
			itemKey: key,
			quantity: 20,
			buyoutAmount: 500,
			status: 0,
			timeLeftSeconds: 60,
		}),
		GetItemKeyFromItem: () => key,
		IsSellItemValid: () => true,
		GetItemCommodityStatus: () => (commodity ? 2 : 1),
		GetAvailablePostCount: () => 80,
		CalculateCommodityDeposit: () => 50,
		CalculateItemDeposit: () => 50,
		PostCommodity: vi.fn(() => false),
		PostItem: vi.fn(() => false),
		ConfirmPostCommodity: vi.fn(),
		ConfirmPostItem: vi.fn(),
		CancelSell: vi.fn(),
		CloseAuctionHouse: vi.fn(),
		SetFavoriteItem: vi.fn(),
		IsFavoriteItem: () => true,
		HasFullBrowseResults: () => true,
		HasFullCommoditySearchResults: () => true,
		HasFullItemSearchResults: () => true,
	};
	const token = {
		UpdateMarketPrice: vi.fn(),
		GetCurrentMarketPrice: () => 999,
		GetCommerceSystemStatus: () => true,
		BuyToken: vi.fn(),
		IsAuctionableWowToken: () => false,
	};
	vi.stubGlobal("C_AuctionHouse", api);
	vi.stubGlobal("C_WowTokenPublic", token);
	vi.stubGlobal("C_WowTokenUI", { StartTokenSell: vi.fn() });
	vi.stubGlobal("C_Item", { GetItemGUID: () => "Item-token" });
	vi.stubGlobal("GetMoney", () => 1000000);
	vi.stubGlobal("GetTime", () => 0);
	vi.stubGlobal("OpenAllBags", vi.fn());
	vi.stubGlobal("C_Container", {
		GetContainerItemInfo: () => ({
			itemID: 123,
			hyperlink: "item:123",
			stackCount: 80,
		}),
	});
	vi.stubGlobal("ItemLocation", {
		CreateFromBagAndSlot: (bagID: number, slotIndex: number) => ({
			bagID,
			slotIndex,
		}),
	});
	const events = createTestEventBus();
	const client = new AuctionHouseClient(events);
	client.setOpen(true);
	return { api, token, client, events };
}
it("lands on favourites with the token first and searches without categories", () => {
	const { client, api } = setup();
	client.search("");
	expect(api.SearchForFavorites).toHaveBeenCalled();
	expect(client.getBrowse().at(0)?.token).toBe(true);
	client.search("Ore");
	expect(api.SendBrowseQuery).toHaveBeenCalledWith(
		expect.objectContaining({
			searchString: "Ore",
			itemClassFilters: [],
			filters: [],
		}),
	);
	expect(client.getBrowse().some((item) => item.token)).toBe(false);
});
it("quotes the chosen quantity without purchasing, then requires an explicit buy action", () => {
	const { client, api } = setup();
	client.select(client.getBrowse().at(1));
	client.setQuantity(10);
	expect(client.getPurchase()?.total).toBe(1500);
	expect(api.ConfirmCommoditiesPurchase).not.toHaveBeenCalled();
	client.update({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 200,
		totalPrice: 1500,
	});
	client.buy(1500);
	expect(api.ConfirmCommoditiesPurchase).toHaveBeenCalledWith(123, 10);
	client.buy(1500);
	expect(api.ConfirmCommoditiesPurchase).toHaveBeenCalledOnce();
});
it("invalidates quotes when amounts change, prices rise, expire, or the house closes", () => {
	const { client, api } = setup();
	client.select(client.getBrowse().at(1));
	client.setQuantity(10);
	client.update({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 200,
		totalPrice: 1600,
	});
	client.buy(1500);
	expect(api.ConfirmCommoditiesPurchase).not.toHaveBeenCalled();
	client.setQuantity(20);
	client.buy(3500);
	expect(api.ConfirmCommoditiesPurchase).not.toHaveBeenCalled();
	client.update({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 200,
		totalPrice: 3500,
	});
	client.setOpen(false);
	client.buy(3500);
	expect(api.ConfirmCommoditiesPurchase).not.toHaveBeenCalled();
});
it("only buys an entire buyout listing and excludes bids and the player's listings", () => {
	const { client, api } = setup(false);
	client.select(client.getBrowse().at(1));
	expect(client.getListings()).toHaveLength(1);
	client.setQuantity(10);
	client.buy(200);
	expect(api.PlaceBid).not.toHaveBeenCalled();
	client.setQuantity(1);
	client.buy(200);
	expect(api.PlaceBid).toHaveBeenCalledWith(2, 200);
});
it("selects bag items for sale without posting and posts with no bid", () => {
	const { client, api, events } = setup(false);
	const selected = vi.fn();
	events.subscribe("AUCTION_SELL_ITEM_SELECTED", selected);
	client.selectSellItem({
		bagId: 0,
		slotId: 1,
		itemId: 123,
		hyperlink: "item:123",
	});
	expect(selected).toHaveBeenCalledOnce();
	expect(api.PostItem).not.toHaveBeenCalled();
	client.post(1, 12345, 2);
	expect(api.PostItem).toHaveBeenCalledWith(
		expect.anything(),
		2,
		1,
		undefined,
		12345,
	);
	expect(client.getOwned().at(0)?.id).toBe(99);
});
it("routes tokens to Blizzard's token purchase confirmation and enforces quantity one", () => {
	const { client, token } = setup();
	client.select(client.getBrowse().at(0));
	client.setQuantity(10);
	client.buy(999);
	expect(token.BuyToken).not.toHaveBeenCalled();
	client.setQuantity(1);
	client.buy(999);
	expect(token.BuyToken).toHaveBeenCalledOnce();
});

it("rejects a buyout whose current price exceeds the total the user saw", () => {
	const { client, api } = setup(false);
	client.select(client.getBrowse().at(1));
	client.buy(150);
	expect(api.PlaceBid).not.toHaveBeenCalled();
});
it("shows zero prices and cannot buy with invalid custom quantities", () => {
	const { client, api } = setup();
	client.select(client.getBrowse().at(1));
	client.setQuantity(Number.NaN);
	expect(client.getPurchase()).toMatchObject({
		total: 0,
		unit: 0,
		ready: false,
	});
	client.buy(100);
	expect(api.StartCommoditiesPurchase).not.toHaveBeenCalled();
	expect(api.ConfirmCommoditiesPurchase).not.toHaveBeenCalled();
});
it("serializes amount changes so a late quote cannot authorize a different quantity", () => {
	const { client, api } = setup();
	client.select(client.getBrowse().at(1));
	client.setQuantity(10);
	client.setQuantity(20);
	client.update({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 200,
		totalPrice: 1500,
	});
	expect(client.getPurchase()?.ready).toBe(false);
	expect(api.StartCommoditiesPurchase).toHaveBeenLastCalledWith(123, 20);
	client.update({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 200,
		totalPrice: 3500,
	});
	expect(client.getPurchase()?.ready).toBe(true);
	api.GetQuoteDurationRemaining = () => 0;
	client.buy(3500);
	expect(api.ConfirmCommoditiesPurchase).not.toHaveBeenCalled();
});

it("requires the original posting details when confirming a server warning", () => {
	const { client, api } = setup();
	api.PostCommodity.mockReturnValue(true);
	client.selectSellItem({
		bagId: 0,
		slotId: 1,
		itemId: 123,
		hyperlink: "item:123",
	});
	client.post(10, 100, 2);
	expect(client.getPostConfirmation()).toEqual({
		quantity: 10,
		price: 100,
		duration: 2,
	});
	client.confirmPost(20, 100, 2);
	expect(api.ConfirmPostCommodity).not.toHaveBeenCalled();
	client.confirmPost(10, 100, 2);
	expect(api.ConfirmPostCommodity).toHaveBeenCalledWith(
		expect.anything(),
		2,
		10,
		100,
	);
});
it("queues the latest search while throttled and resumes it when the server is ready", () => {
	const { client, api } = setup();
	api.IsThrottledMessageSystemReady = () => false;
	client.search("Ore");
	client.search("Cloth");
	expect(api.SendBrowseQuery).not.toHaveBeenCalled();
	api.IsThrottledMessageSystemReady = () => true;
	client.update({ kind: "AUCTION_HOUSE_THROTTLED_SYSTEM_READY" });
	expect(api.SendBrowseQuery).toHaveBeenCalledOnce();
	expect(api.SendBrowseQuery).toHaveBeenCalledWith(
		expect.objectContaining({ searchString: "Cloth" }),
	);
});

it("selects auctionable tokens from bags and posts through Blizzard's token confirmation", () => {
	const { client, token, api } = setup(false);
	token.IsAuctionableWowToken = () => true;
	client.selectSellItem({
		bagId: 0,
		slotId: 1,
		itemId: 123,
		hyperlink: "item:123",
	});
	expect(client.getSellItem()?.token).toBe(true);
	expect(client.getDeposit(1, 2)).toBe(0);
	client.post(1, 999, 2);
	expect(C_WowTokenUI.StartTokenSell).toHaveBeenCalledWith("Item-token");
	expect(api.PostItem).not.toHaveBeenCalled();
});

it("keeps the displayed average unit price consistent with the server's lower total", () => {
	const { client } = setup();
	client.select(client.getBrowse().at(1));
	client.setQuantity(10);
	client.update({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 200,
		totalPrice: 1400,
	});
	expect(client.getPurchase()).toMatchObject({
		unit: 140,
		total: 1400,
		ready: true,
	});
});
