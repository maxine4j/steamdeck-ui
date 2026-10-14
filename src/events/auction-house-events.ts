import type { AuctionUpdate } from "../clients/auction-house-client";

export const auctionUpdateEvents = [
	"AUCTION_HOUSE_BROWSE_RESULTS_UPDATED",
	"AUCTION_HOUSE_BROWSE_RESULTS_ADDED",
	"ITEM_SEARCH_RESULTS_UPDATED",
	"ITEM_SEARCH_RESULTS_ADDED",
	"ITEM_KEY_ITEM_INFO_RECEIVED",
	"COMMODITY_SEARCH_RESULTS_UPDATED",
	"COMMODITY_SEARCH_RESULTS_ADDED",
	"COMMODITY_PRICE_UPDATED",
	"COMMODITY_PRICE_UNAVAILABLE",
	"COMMODITY_PURCHASE_SUCCEEDED",
	"COMMODITY_PURCHASE_FAILED",
	"OWNED_AUCTIONS_UPDATED",
	"AUCTION_HOUSE_PURCHASE_COMPLETED",
	"AUCTION_HOUSE_AUCTION_CREATED",
	"AUCTION_HOUSE_THROTTLED_SYSTEM_READY",
	"AUCTION_HOUSE_SHOW_ERROR",
	"AUCTION_HOUSE_POST_WARNING",
	"AUCTION_HOUSE_POST_ERROR",
	"AUCTION_HOUSE_FAVORITES_UPDATED",
	"TOKEN_MARKET_PRICE_UPDATED",
	"TOKEN_BUY_RESULT",
	"TOKEN_SELL_RESULT",
] as const;

/** Convert native table/scalar result identifiers and price tuples at the bus. */
export function auctionUpdate(
	kind: string,
	args: readonly unknown[],
): AuctionUpdate {
	const first = args.at(0);
	if (kind === "COMMODITY_PRICE_UPDATED")
		return {
			kind,
			unitPrice: typeof first === "number" ? first : undefined,
			totalPrice:
				typeof args.at(1) === "number" ? (args.at(1) as number) : undefined,
		};
	const itemID =
		typeof first === "number"
			? first
			: typeof first === "object" && first !== null
				? (first as { itemID?: number }).itemID
				: undefined;
	return { kind, itemID };
}
