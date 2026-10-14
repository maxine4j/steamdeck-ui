import type { IEventBus } from "../events/types";
import type { WowFrame } from "../types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";
import type {
	NativeScriptSuppression,
	ScriptedFrame,
} from "../ui/components/native-script-suppression";
import type { InventorySlot } from "./inventory-client";

export interface AuctionKey {
	readonly itemID: number;
	readonly itemLevel: number;
	readonly itemSuffix: number;
	readonly battlePetSpeciesID: number;
}
export interface AuctionItem {
	readonly key: AuctionKey;
	readonly name: string;
	readonly icon: number;
	readonly commodity: boolean;
	readonly token?: boolean;
	readonly price: number;
	readonly quantity: number;
}
export interface AuctionListing {
	readonly id: number;
	readonly quantity: number;
	readonly unitPrice: number;
	readonly total: number;
}
export interface OwnedAuction extends AuctionListing {
	readonly name: string;
	readonly sold: boolean;
	readonly secondsLeft: number;
}
export interface AuctionUpdate {
	readonly kind: string;
	readonly itemID?: number;
	readonly unitPrice?: number;
	readonly totalPrice?: number;
}
export interface AuctionPurchase {
	readonly item: AuctionItem;
	readonly quantity: number;
	readonly unit: number;
	readonly total: number;
	readonly ready: boolean;
}
export interface AuctionSellItem extends AuctionItem {
	readonly slot: InventorySlot;
}
export interface AuctionPost {
	readonly quantity: number;
	readonly price: number;
	readonly duration: number;
}
export interface IAuctionHouseClient {
	disableBuiltIn(): void;
	restoreBuiltIn(): void;
	setOpen(open: boolean): void;
	isOpen(): boolean;
	search(text: string): void;
	getBrowse(): AuctionItem[];
	select(item?: AuctionItem): void;
	setQuantity(quantity: number): void;
	getPurchase(): AuctionPurchase | undefined;
	getListings(selling?: boolean): AuctionListing[];
	buy(maxTotal: number): void;
	update(update: AuctionUpdate): void;
	selectSellItem(slot: InventorySlot): void;
	getSellItem(): AuctionSellItem | undefined;
	getDeposit(quantity: number, duration: number): number | undefined;
	post(quantity: number, unitPrice: number, duration: number): void;
	getPostConfirmation(): AuctionPost | undefined;
	confirmPost(quantity: number, price: number, duration: number): void;
	queryOwned(): void;
	getOwned(): OwnedAuction[];
	loadMore(): void;
	toggleFavorite(): void;
	getStatus(): string;
	close(): void;
}

// The generator flattens API tables to numbers and changes ID to Id. Keep the
// actual FrameXML signatures at this boundary, without editing generated code.
interface Location {
	readonly bagID: number;
	readonly slotIndex: number;
}
interface Result {
	readonly auctionID: number;
	readonly quantity: number;
	readonly unitPrice: number;
	readonly buyoutAmount: number;
	readonly itemKey: AuctionKey;
	readonly numOwnerItems?: number;
	readonly containsOwnerItem?: boolean;
	readonly containsAccountItem?: boolean;
	readonly status: number;
	readonly timeLeftSeconds: number;
}
interface AuctionApi {
	SearchForFavorites(this: void, sorts: readonly unknown[]): void;
	SendBrowseQuery(
		this: void,
		query: {
			searchString: string;
			sorts: readonly unknown[];
			filters: readonly unknown[];
			itemClassFilters: readonly unknown[];
		},
	): void;
	SendSearchQuery(
		this: void,
		key: AuctionKey,
		sorts: readonly unknown[],
		separateOwnerItems: boolean,
	): void;
	IsThrottledMessageSystemReady(this: void): boolean;
	GetBrowseResults(
		this: void,
	): { itemKey: AuctionKey; minPrice: number; totalQuantity: number }[];
	GetItemKeyInfo(
		this: void,
		key: AuctionKey,
	): { itemName: string; iconFileID: number; isCommodity: boolean } | undefined;
	GetNumCommoditySearchResults(this: void, id: number): number;
	GetCommoditySearchResultInfo(
		this: void,
		id: number,
		index: number,
	): Result | undefined;
	GetNumItemSearchResults(this: void, key: AuctionKey): number;
	GetItemSearchResultInfo(
		this: void,
		key: AuctionKey,
		index: number,
	): Result | undefined;
	StartCommoditiesPurchase(
		this: void,
		id: number,
		quantity: number,
		unitPrice?: number,
	): void;
	ConfirmCommoditiesPurchase(this: void, id: number, quantity: number): void;
	CancelCommoditiesPurchase(this: void): void;
	GetQuoteDurationRemaining(this: void): number;
	PlaceBid(this: void, id: number, amount: number): void;
	QueryOwnedAuctions(this: void, sorts: readonly unknown[]): void;
	GetNumOwnedAuctions(this: void): number;
	GetOwnedAuctionInfo(this: void, index: number): Result | undefined;
	GetItemKeyFromItem(this: void, location: Location): AuctionKey;
	IsSellItemValid(this: void, location: Location): boolean;
	GetItemCommodityStatus(this: void, location: Location): number;
	GetAvailablePostCount(this: void, location: Location): number;
	CalculateCommodityDeposit(
		this: void,
		id: number,
		duration: number,
		quantity: number,
	): number | undefined;
	CalculateItemDeposit(
		this: void,
		location: Location,
		duration: number,
		quantity: number,
	): number | undefined;
	PostCommodity(
		this: void,
		location: Location,
		duration: number,
		quantity: number,
		unitPrice: number,
	): boolean;
	PostItem(
		this: void,
		location: Location,
		duration: number,
		quantity: number,
		bid: undefined,
		buyout: number,
	): boolean;
	ConfirmPostCommodity(
		this: void,
		location: Location,
		duration: number,
		quantity: number,
		unitPrice: number,
	): void;
	ConfirmPostItem(
		this: void,
		location: Location,
		duration: number,
		quantity: number,
		bid: undefined,
		buyout: number,
	): void;
	CancelSell(this: void): void;
	CloseAuctionHouse(this: void): void;
	SetFavoriteItem(this: void, key: AuctionKey, favorite: boolean): void;
	IsFavoriteItem(this: void, key: AuctionKey): boolean;
	HasFullBrowseResults(this: void): boolean;
	HasFullCommoditySearchResults(this: void, id: number): boolean;
	HasFullItemSearchResults(this: void, key: AuctionKey): boolean;
	RequestMoreBrowseResults(this: void): void;
	RequestMoreCommoditySearchResults(this: void, id: number): void;
	RequestMoreItemSearchResults(this: void, key: AuctionKey): void;
}
declare const ItemLocation: {
	CreateFromBagAndSlot(this: unknown, bag: number, slot: number): Location;
};
declare const C_WowTokenPublic: {
	UpdateMarketPrice(this: void): void;
	GetCurrentMarketPrice(this: void): number | undefined;
	GetCommerceSystemStatus(this: void): boolean;
	BuyToken(this: void): void;
	IsAuctionableWowToken(this: void, itemID: number): boolean;
};
declare const C_WowTokenUI: { StartTokenSell(this: void, guid: string): void };
function api(): AuctionApi {
	return C_AuctionHouse as unknown as AuctionApi;
}
function positive(value: number): boolean {
	return value > 0 && value === Math.floor(value) && value < 2147483647;
}

export class AuctionHouseClient implements IAuctionHouseClient {
	private open = false;
	private text = "";
	private selected?: AuctionItem;
	private sell?: AuctionSellItem;
	private quantity = 1;
	private status = "";
	private busy = false;
	private pendingSearch?: () => void;
	private quoteRequest?: { item: AuctionItem; quantity: number; total: number };
	private quote?: { quantity: number; total: number };
	private pendingPost?: { quantity: number; price: number; duration: number };
	constructor(
		private readonly events: IEventBus,
		private readonly frames?: IFrameSuppression,
		private readonly scripts?: NativeScriptSuppression,
	) {}
	disableBuiltIn(): void {
		const native = (
			_G as unknown as {
				AuctionHouseFrame?: WowFrame &
					ScriptedFrame & { GetParent(): WowFrame | undefined };
			}
		).AuctionHouseFrame;
		if (!native) return;
		// Hidden parenting preserves interaction state; suppress queries and close
		// side effects caused by the native panel's show/hide lifecycle.
		this.scripts?.suppress(native, ["OnShow", "OnHide", "OnEvent"]);
		this.frames?.suppress([native]);
	}
	restoreBuiltIn(): void {
		this.frames?.restore();
		this.scripts?.restore();
	}
	setOpen(open: boolean): void {
		this.open = open;
		this.selected = undefined;
		this.sell = undefined;
		this.quote = undefined;
		this.quoteRequest = undefined;
		this.pendingSearch = undefined;
		this.pendingPost = undefined;
		this.busy = false;
		this.status = "";
		this.text = "";
		if (open) {
			OpenAllBags();
			C_WowTokenPublic.UpdateMarketPrice();
		} else api().CancelCommoditiesPurchase();
		this.events.emit("INVENTORY_ITEM_USE_TARGET_CHANGED");
	}
	isOpen(): boolean {
		return this.open;
	}
	private request(action: () => void): void {
		if (!this.open) return;
		if (api().IsThrottledMessageSystemReady()) {
			this.pendingSearch = undefined;
			action();
		} else {
			this.pendingSearch = action;
			this.status = "Waiting for auction house…";
		}
	}
	search(text: string): void {
		this.select();
		this.text = text.trim();
		this.status = "Searching…";
		this.request(() =>
			this.text === ""
				? api().SearchForFavorites([])
				: api().SendBrowseQuery({
						searchString: this.text,
						sorts: [],
						filters: [],
						itemClassFilters: [],
					}),
		);
	}
	private item(key: AuctionKey, price = 0, quantity = 0): AuctionItem {
		const info = api().GetItemKeyInfo(key);
		return {
			key,
			name: info?.itemName ?? `Item ${key.itemID}`,
			icon: info?.iconFileID ?? 134400,
			commodity: info?.isCommodity ?? false,
			price,
			quantity,
		};
	}
	getBrowse(): AuctionItem[] {
		if (!this.open) return [];
		const items = api()
			.GetBrowseResults()
			.map((result) =>
				this.item(result.itemKey, result.minPrice, result.totalQuantity),
			);
		if (this.text === "")
			items.unshift({
				key: {
					itemID: 122284,
					itemLevel: 0,
					itemSuffix: 0,
					battlePetSpeciesID: 0,
				},
				name: "WoW Token",
				icon: 1120721,
				token: true,
				commodity: false,
				quantity: 1,
				price: C_WowTokenPublic.GetCurrentMarketPrice() ?? 0,
			});
		return items;
	}
	select(item?: AuctionItem): void {
		if (this.busy) return;
		if (!this.quoteRequest) api().CancelCommoditiesPurchase();
		this.quote = undefined;
		this.selected = item;
		this.quantity = 1;
		this.pendingSearch = undefined;
		if (item && !item.token)
			this.request(() => api().SendSearchQuery(item.key, [], false));
		this.status = "";
	}
	setQuantity(quantity: number): void {
		if (this.busy) return;
		this.quantity = quantity;
		this.quote = undefined;
		this.requestQuote();
	}
	getListings(selling = false): AuctionListing[] {
		const item = selling ? this.sell : this.selected;
		if (!this.open || !item || item.token) return [];
		const listings: AuctionListing[] = [];
		const count = item.commodity
			? api().GetNumCommoditySearchResults(item.key.itemID)
			: api().GetNumItemSearchResults(item.key);
		for (let index = 1; index <= count; index++) {
			const result = item.commodity
				? api().GetCommoditySearchResultInfo(item.key.itemID, index)
				: api().GetItemSearchResultInfo(item.key, index);
			if (!result) continue;
			const quantity = item.commodity
				? result.quantity - (result.numOwnerItems ?? 0)
				: result.quantity;
			if (
				quantity <= 0 ||
				(!item.commodity &&
					(result.buyoutAmount <= 0 ||
						result.containsOwnerItem ||
						result.containsAccountItem))
			)
				continue;
			const unit = item.commodity
				? result.unitPrice
				: result.buyoutAmount / quantity;
			listings.push({
				id: result.auctionID ?? index,
				quantity,
				unitPrice: unit,
				total: item.commodity ? unit * quantity : result.buyoutAmount,
			});
		}
		return listings.sort((a, b) => a.unitPrice - b.unitPrice);
	}
	getPurchase(): AuctionPurchase | undefined {
		const item = this.selected;
		if (!this.open || !item) return undefined;
		if (!positive(this.quantity))
			return { item, quantity: this.quantity, total: 0, unit: 0, ready: false };
		let total = 0;
		let remaining = this.quantity;
		if (item.token) {
			total = C_WowTokenPublic.GetCurrentMarketPrice() ?? 0;
			remaining = this.quantity === 1 ? 0 : this.quantity;
		} else if (item.commodity) {
			for (const row of this.getListings()) {
				const count = Math.min(remaining, row.quantity);
				total += count * row.unitPrice;
				remaining -= count;
				if (remaining <= 0) break;
			}
		} else {
			const row = this.getListings().find(
				(listing) => listing.quantity === this.quantity,
			);
			if (row) {
				total = row.total;
				remaining = 0;
			}
		}
		const valid =
			positive(this.quantity) &&
			remaining === 0 &&
			total > 0 &&
			total <= GetMoney() &&
			!this.busy;
		return {
			item,
			quantity: this.quantity,
			unit: Math.ceil((this.quote?.total ?? total) / this.quantity),
			total: this.quote?.total ?? total,
			ready:
				valid &&
				(!item.commodity ||
					(this.quote?.quantity === this.quantity &&
						this.quote.total <= GetMoney() &&
						api().GetQuoteDurationRemaining() > 0)) &&
				(!item.token || C_WowTokenPublic.GetCommerceSystemStatus()),
		};
	}
	private requestQuote(): void {
		const purchase = this.getPurchase();
		if (
			!purchase?.item.commodity ||
			this.quoteRequest ||
			!positive(this.quantity) ||
			purchase.total <= 0 ||
			purchase.total > GetMoney() ||
			this.busy
		)
			return;
		this.request(() => {
			this.quoteRequest = {
				item: purchase.item,
				quantity: this.quantity,
				total: purchase.total,
			};
			api().StartCommoditiesPurchase(purchase.item.key.itemID, this.quantity);
		});
	}
	buy(maxTotal: number): void {
		const purchase = this.getPurchase();
		if (!positive(maxTotal) || (purchase && purchase.total > maxTotal)) {
			this.status = "Price changed. Review the new total before buying.";
			return;
		}
		if (!purchase?.ready) {
			this.requestQuote();
			return;
		}
		if (purchase.item.token) C_WowTokenPublic.BuyToken();
		else if (purchase.item.commodity)
			api().ConfirmCommoditiesPurchase(
				purchase.item.key.itemID,
				purchase.quantity,
			);
		else {
			const listing = this.getListings().find(
				(row) =>
					row.quantity === purchase.quantity && row.total === purchase.total,
			);
			if (!listing) return;
			// PlaceBid at the full buyout is Blizzard's buyout API. No bid path.
			api().PlaceBid(listing.id, listing.total);
		}
		this.busy = true;
		this.quote = undefined;
		this.status = "Purchase pending…";
	}
	update(update: AuctionUpdate): void {
		if (!this.open) return;
		if (update.kind === "AUCTION_HOUSE_THROTTLED_SYSTEM_READY") {
			const pending = this.pendingSearch;
			this.pendingSearch = undefined;
			pending?.();
		}
		if (update.kind === "COMMODITY_PRICE_UPDATED") {
			const request = this.quoteRequest;
			this.quoteRequest = undefined;
			if (
				request &&
				request.item === this.selected &&
				request.quantity === this.quantity &&
				update.totalPrice !== undefined &&
				update.totalPrice <= request.total &&
				update.totalPrice > 0
			) {
				this.quote = { quantity: request.quantity, total: update.totalPrice };
				this.status = "";
			} else {
				this.quote = undefined;
				api().CancelCommoditiesPurchase();
				this.status = "Price changed. Select the amount again to refresh.";
				if (
					request &&
					(request.quantity !== this.quantity || request.item !== this.selected)
				)
					this.requestQuote();
			}
		} else if (update.kind === "COMMODITY_PRICE_UNAVAILABLE") {
			this.quoteRequest = undefined;
			this.quote = undefined;
			this.status = "Price unavailable. Select the amount again.";
		} else if (
			update.kind === "COMMODITY_SEARCH_RESULTS_UPDATED" ||
			update.kind === "COMMODITY_SEARCH_RESULTS_ADDED"
		) {
			if (update.itemID === this.selected?.key.itemID) this.requestQuote();
		}
		if (
			[
				"COMMODITY_PURCHASE_SUCCEEDED",
				"COMMODITY_PURCHASE_FAILED",
				"AUCTION_HOUSE_PURCHASE_COMPLETED",
				"AUCTION_HOUSE_SHOW_ERROR",
				"AUCTION_HOUSE_AUCTION_CREATED",
				"AUCTION_HOUSE_POST_ERROR",
				"TOKEN_BUY_RESULT",
				"TOKEN_SELL_RESULT",
			].includes(update.kind)
		) {
			this.busy = false;
			this.quote = undefined;
			this.quoteRequest = undefined;
			this.status =
				update.kind.includes("ERROR") || update.kind.includes("FAILED")
					? "Auction action failed. Refresh and try again."
					: "";
			if (update.kind === "AUCTION_HOUSE_AUCTION_CREATED") {
				this.sell = undefined;
				this.pendingPost = undefined;
			}
		}
		if (update.kind === "AUCTION_HOUSE_POST_WARNING")
			this.status = "Posting requires confirmation. Review and confirm below.";
		if (update.kind.startsWith("AUCTION_HOUSE_BROWSE_RESULTS"))
			this.status = "";
	}
	private location(slot: InventorySlot): Location | undefined {
		if (slot.bagId < 0 || slot.bagId > 5 || slot.slotId < 1) return undefined;
		const current = C_Container.GetContainerItemInfo(slot.bagId, slot.slotId);
		if (
			!current ||
			current.isLocked ||
			current.itemID !== slot.itemId ||
			(slot.hyperlink !== undefined && current.hyperlink !== slot.hyperlink)
		)
			return undefined;
		return ItemLocation.CreateFromBagAndSlot(slot.bagId, slot.slotId);
	}
	selectSellItem(slot: InventorySlot): void {
		if (!this.open || this.busy) return;
		const location = this.location(slot);
		if (!location || !api().IsSellItemValid(location)) {
			this.status = "This item cannot be auctioned.";
			return;
		}
		const token = C_WowTokenPublic.IsAuctionableWowToken(slot.itemId);
		this.select();
		this.pendingPost = undefined;
		const key = api().GetItemKeyFromItem(location);
		this.sell = {
			...this.item(key, 0, api().GetAvailablePostCount(location)),
			token,
			price: token ? (C_WowTokenPublic.GetCurrentMarketPrice() ?? 0) : 0,
			commodity: api().GetItemCommodityStatus(location) === 2,
			slot,
		};
		if (!token) this.request(() => api().SendSearchQuery(key, [], false));
		this.events.emit("AUCTION_SELL_ITEM_SELECTED");
	}
	getSellItem(): AuctionSellItem | undefined {
		if (!this.open || !this.sell) return undefined;
		return this.sell.token
			? { ...this.sell, price: C_WowTokenPublic.GetCurrentMarketPrice() ?? 0 }
			: this.sell;
	}
	getDeposit(quantity: number, duration: number): number | undefined {
		const item = this.getSellItem();
		const location = item && this.location(item.slot);
		if (
			!item ||
			!location ||
			!positive(quantity) ||
			quantity > api().GetAvailablePostCount(location) ||
			![1, 2, 3].includes(duration)
		)
			return undefined;
		if (item.token) return quantity === 1 ? 0 : undefined;
		return item.commodity
			? api().CalculateCommodityDeposit(item.key.itemID, duration, quantity)
			: api().CalculateItemDeposit(location, duration, quantity);
	}
	post(quantity: number, unitPrice: number, duration: number): void {
		const item = this.getSellItem();
		const location = item && this.location(item.slot);
		const deposit = this.getDeposit(quantity, duration);
		if (
			!item ||
			!location ||
			this.busy ||
			!positive(unitPrice) ||
			deposit === undefined ||
			deposit > GetMoney() ||
			!api().IsThrottledMessageSystemReady() ||
			!api().IsSellItemValid(location)
		)
			return;
		if (item.token) {
			const price = C_WowTokenPublic.GetCurrentMarketPrice();
			const getGuid = C_Item.GetItemGUID as unknown as (
				this: void,
				item: Location,
			) => string | undefined;
			const guid = getGuid(location);
			if (
				quantity === 1 &&
				guid &&
				price &&
				price === unitPrice &&
				C_WowTokenPublic.GetCommerceSystemStatus()
			) {
				C_WowTokenUI.StartTokenSell(guid);
				this.busy = true;
				this.status = "Confirm the token sale in Blizzard's dialog.";
			}
			return;
		}
		const needsConfirmation = item.commodity
			? api().PostCommodity(location, duration, quantity, unitPrice)
			: api().PostItem(
					location,
					duration,
					quantity,
					undefined,
					unitPrice * quantity,
				);
		this.pendingPost = needsConfirmation
			? { quantity, price: unitPrice, duration }
			: undefined;
		this.busy = true;
		this.status = needsConfirmation
			? "Review the price and confirm posting."
			: "Posting…";
	}
	getPostConfirmation(): AuctionPost | undefined {
		return this.pendingPost;
	}
	confirmPost(quantity: number, price: number, duration: number): void {
		const post = this.pendingPost;
		const item = this.getSellItem();
		const location = item && this.location(item.slot);
		if (
			!post ||
			!item ||
			!location ||
			quantity !== post.quantity ||
			price !== post.price ||
			duration !== post.duration
		)
			return;
		this.pendingPost = undefined;
		if (item.commodity)
			api().ConfirmPostCommodity(
				location,
				post.duration,
				post.quantity,
				post.price,
			);
		else
			api().ConfirmPostItem(
				location,
				post.duration,
				post.quantity,
				undefined,
				post.price * post.quantity,
			);
	}
	queryOwned(): void {
		this.request(() => api().QueryOwnedAuctions([]));
	}
	getOwned(): OwnedAuction[] {
		if (!this.open) return [];
		const rows: OwnedAuction[] = [];
		for (let index = 1; index <= api().GetNumOwnedAuctions(); index++) {
			const row = api().GetOwnedAuctionInfo(index);
			if (row)
				rows.push({
					id: row.auctionID,
					name: this.item(row.itemKey).name,
					quantity: row.quantity,
					unitPrice: row.buyoutAmount / row.quantity,
					total: row.buyoutAmount,
					sold: row.status === 1,
					secondsLeft: row.timeLeftSeconds,
				});
		}
		return rows;
	}
	loadMore(): void {
		this.request(() => {
			const item = this.selected ?? this.sell;
			if (!item) {
				if (!api().HasFullBrowseResults()) api().RequestMoreBrowseResults();
			} else if (item.commodity) {
				if (!api().HasFullCommoditySearchResults(item.key.itemID))
					api().RequestMoreCommoditySearchResults(item.key.itemID);
			} else if (!item.token && !api().HasFullItemSearchResults(item.key))
				api().RequestMoreItemSearchResults(item.key);
		});
	}
	toggleFavorite(): void {
		if (this.open && this.selected && !this.selected.token)
			api().SetFavoriteItem(
				this.selected.key,
				!api().IsFavoriteItem(this.selected.key),
			);
	}
	getStatus(): string {
		return this.status;
	}
	close(): void {
		if (this.open) {
			this.setOpen(false);
			api().CancelSell();
			api().CloseAuctionHouse();
		}
	}
}
