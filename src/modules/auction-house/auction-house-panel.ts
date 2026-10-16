import type {
	AuctionItem,
	AuctionSellItem,
	IAuctionHouseClient,
} from "../../clients/auction-house-client";
import { Frame } from "../../ui/components/frame";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import { formatMoney } from "../../utils/money";

interface Control {
	readonly frame: Frame;
	readonly nav: INavigable;
}
export class AuctionHousePanel implements IPanel {
	readonly title: string;
	readonly icon = 133784;
	private readonly frame: Frame;
	private readonly list: ScrollList;
	private readonly detailList: ScrollList;
	private readonly controls = new Map<string, Control>();
	private readonly searchInput: Frame;
	private readonly quantityInput: Frame;
	private readonly priceInput: Frame;
	private mounted = false;
	private writing = false;
	private searchText = "";
	private sellQuantity = 1;
	private sellPrice = 0;
	private sellPriceEdited = false;
	private duration = 2;
	private sellItem?: AuctionSellItem;
	private visibleControls: Control[][] = [];
	private navigationChanged?: (focusId?: string) => void;
	private generation = 0;
	private layoutMode?: string;
	private displayedTotal = 0;
	constructor(
		readonly id: "auction-buy" | "auction-sell" | "auction-owned",
		pool: IFramePoolManager,
		private readonly client: IAuctionHouseClient,
		private readonly close: () => void,
	) {
		this.title =
			id === "auction-buy"
				? "Buy"
				: id === "auction-sell"
					? "Sell"
					: "Auctions";
		this.frame = new Frame(`${id}-root`, pool);
		this.list = new ScrollList(`${id}-list`, pool, "", () => {}, {
			top: id === "auction-buy" ? 154 : id === "auction-sell" ? 322 : 112,
			bottom: 16,
			background: false,
		});
		this.detailList = new ScrollList(`${id}-prices`, pool, "", () => {}, {
			top: 310,
			bottom: 16,
			background: false,
		});
		this.searchInput = new Frame(`${id}-search`, pool, "SearchBox");
		this.quantityInput = new Frame(`${id}-quantity`, pool, "EditBox");
		this.priceInput = new Frame(`${id}-price`, pool, "EditBox");
		const button = (key: string, action: () => void) => {
			const frame = new Frame(`${id}-${key}`, pool, "Button");
			const activate = () => {
				if (!this.mounted) return;
				action();
				this.refresh();
			};
			this.controls.set(key, {
				frame,
				nav: {
					navId: frame.id,
					mouseTarget: frame,
					onFocus: () => frame.setFocused(true),
					onBlur: () => frame.setFocused(false),
					onInteract: activate,
				},
			});
		};
		button("search-submit", () => {
			this.searchInput.blurInput();
			this.client.search(this.searchText);
		});
		for (const count of [1, 10, 20, 50, 200])
			button(`amount-${count}`, () => {
				this.client.setQuantity(count);
				this.setText(this.quantityInput, `${count}`);
			});
		button("submit", () =>
			id === "auction-buy"
				? this.client.buy(this.displayedTotal)
				: this.client.post(this.sellQuantity, this.sellPrice, this.duration),
		);
		button("back", () => this.onBack());
		button("star", () => this.client.toggleFavorite());
		button("more", () => this.client.loadMore());
		button("refresh", () => this.client.queryOwned());
		button("confirm-post", () =>
			this.client.confirmPost(this.sellQuantity, this.sellPrice, this.duration),
		);
		for (const hours of [12, 24, 48])
			button(`duration-${hours}`, () => {
				this.duration = hours === 12 ? 1 : hours === 24 ? 2 : 3;
			});
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
		this.navigationChanged = callback;
	}
	private setText(input: Frame, text: string): void {
		this.writing = true;
		input.setInputText(text);
		this.writing = false;
	}
	private input(
		input: Frame,
		_label: string,
		x: number,
		y: number,
		width: number,
	): Control {
		input.setParent(this.frame);
		input.layout(width, 32, "TOPLEFT", this.frame, x, -y);
		input.setInsetBackground();
		input.show();
		return {
			frame: input,
			nav: {
				navId: input.id,
				mouseTarget: input,
				onFocus: () => input.setFocused(true),
				onBlur: () => {
					input.setFocused(false);
					input.blurInput();
				},
				onInteract: () => {
					if (this.mounted) input.focusInput();
				},
			},
		};
	}
	private button(
		key: string,
		label: string,
		x: number,
		y: number,
		width = 140,
		selected = false,
	): Control {
		const control = this.controls.get(key);
		if (!control) throw new Error(`Unknown auction control ${key}`);
		control.frame.setParent(this.frame);
		control.frame.layout(width, 32, "TOPLEFT", this.frame, x, -y);
		control.frame.onClick((mouse) => {
			if (mouse === "LeftButton") control.nav.onInteract();
		});
		const primary = key === "submit" || key === "confirm-post";
		if (primary) control.frame.setButtonBackground();
		else if (key.startsWith("amount-") || key.startsWith("duration-")) {
			control.frame.setInsetBackground();
			control.frame.setBorder(
				selected ? [1, 0.82, 0, 1] : [0.45, 0.4, 0.3, 1],
				1,
			);
		} else control.frame.setColor(0, 0, 0, 0);
		control.frame.setLabel(
			"text",
			primary ? label : `|cffffd100${label}|r`,
			"CENTER",
			0,
			0,
			13,
			width - 8,
		);
		control.frame.show();
		return control;
	}
	private label(key: string, text: string, y: number): void {
		this.frame.setLabel(key, text, "TOPLEFT", 16, -y, 13, 448);
	}
	refresh(): void {
		if (!this.mounted) return;
		this.generation++;
		const mode =
			this.id === "auction-buy"
				? this.client.getPurchase()
					? "detail"
					: "browse"
				: this.client.getSellItem()?.token
					? "sell-token"
					: this.client.getSellItem()
						? "sell"
						: "empty";
		if (mode !== this.layoutMode) {
			for (const control of this.controls.values()) control.frame.hide();
			this.searchInput.hide();
			this.quantityInput.hide();
			this.priceInput.hide();
			this.layoutMode = mode;
		}
		this.visibleControls = [];
		for (const key of ["item", "fields", "price", "hint"])
			this.label(key, "", 0);
		this.label(
			"status",
			this.client.getStatus(),
			this.id === "auction-owned"
				? 92
				: this.id === "auction-buy" && mode === "browse"
					? 130
					: 292,
		);
		if (this.id === "auction-buy") this.renderBuy();
		else if (this.id === "auction-sell") this.renderSell();
		else {
			this.list.mount(this.frame);
			this.visibleControls = [
				[this.button("refresh", "Refresh auctions", 16, 52, 180)],
			];
			this.list.setRows(
				this.client.getOwned().map((row) => ({
					id: `auction-owned-${row.id}`,
					label: `${row.name} ×${row.quantity}`,
					detail: `${formatMoney(row.total)} · ${row.sold ? "Sold" : `${Math.ceil(row.secondsLeft / 3600)}h remaining`}`,
					heading: true,
					height: 56,
					fontSize: 14,
					activate: () => {},
				})),
			);
		}
		this.navigationChanged?.();
	}
	private renderBuy(): void {
		const purchase = this.client.getPurchase();
		this.displayedTotal = purchase?.total ?? 0;
		if (!purchase) {
			this.detailList.unmount();
			this.list.mount(this.frame);
			this.visibleControls = [
				[
					this.input(this.searchInput, "Search", 16, 58, 318),
					this.button("search-submit", "Search", 346, 58, 118),
				],
			];
			const generation = this.generation;
			this.list.setRows(
				this.client.getBrowse().map((item) => ({
					id: this.itemID(item),
					label: item.name,
					background: false,
					icon: item.icon,
					detail:
						item.price > 0
							? `From ${formatMoney(item.price)} · ${item.quantity} available`
							: "Price loading…",
					activate: () => {
						if (!this.mounted || generation !== this.generation) return;
						this.client.select(item);
						this.setText(this.quantityInput, "1");
						this.refresh();
						this.navigationChanged?.(`${this.id}-amount-1`);
					},
				})),
			);
			this.visibleControls.push([
				this.button("more", "Load more", 16, 92, 140),
			]);
			return;
		}
		this.list.unmount();
		this.detailList.mount(this.frame);
		this.label("item", purchase.item.name, 56);
		this.visibleControls = [
			[
				...[1, 10, 20, 50, 200].map((quantity, index) =>
					this.button(
						`amount-${quantity}`,
						`${quantity}`,
						16 + index * 90,
						88,
						80,
						purchase.quantity === quantity,
					),
				),
			],
		];
		this.visibleControls.push([
			this.input(this.quantityInput, "Quantity", 16, 132, 100),
		]);
		this.label("hint", "Quantity (edit for a custom amount)", 170);
		this.label(
			"price",
			`Avg. unit: ${formatMoney(purchase.unit)}\nTotal: ${formatMoney(purchase.total)}`,
			186,
		);
		this.visibleControls.push([
			this.button(
				"submit",
				purchase.ready ? "Buy" : "Buy (unavailable)",
				284,
				220,
				180,
			),
		]);
		this.visibleControls.push([
			this.button("back", "Back", 16, 258, 140),
			this.button("star", "Toggle favourite", 164, 258, 148),
			this.button("more", "Load more", 320, 258, 144),
		]);
		this.detailList.setRows(this.priceRows(false));
	}
	private itemID(item: AuctionItem): string {
		return `auction-item-${item.key.itemID}-${item.key.itemLevel ?? 0}-${item.key.itemSuffix ?? 0}-${item.key.battlePetSpeciesID ?? 0}`;
	}
	private priceRows(selling: boolean): ListRow[] {
		return this.client.getListings(selling).map(
			(row, index): ListRow => ({
				id: `auction-listing-${index}`,
				label: `${row.quantity} at ${formatMoney(row.unitPrice)} each`,
				detail: `Total: ${formatMoney(row.total)}`,
				heading: true,
				height: 52,
				fontSize: 13,
				activate: () => {},
			}),
		);
	}
	private renderSell(): void {
		this.list.mount(this.frame);
		const item = this.client.getSellItem();
		if (!item) {
			this.label(
				"hint",
				"Press X or right-click an item in your bags to sell.",
				64,
			);
			this.list.setRows([]);
			this.sellItem = undefined;
			return;
		}
		if (item !== this.sellItem) {
			this.sellItem = item;
			this.sellQuantity = 1;
			this.sellPriceEdited = false;
			this.setText(this.quantityInput, "1");
		}
		if (!this.sellPriceEdited) {
			this.sellPrice = item.token
				? item.price
				: Math.ceil(this.client.getListings(true).at(0)?.unitPrice ?? 0);
			this.setText(this.priceInput, `${this.sellPrice / 10000}`);
		}
		this.label("item", `${item.name} · ${item.quantity} available`, 56);
		if (item.token) {
			this.sellQuantity = 1;
			this.label("price", `Market price: ${formatMoney(item.price)}`, 104);
			this.label(
				"hint",
				"Blizzard will ask you to confirm the token sale.",
				140,
			);
			this.visibleControls = [
				[this.button("submit", "Sell WoW Token", 284, 184, 180)],
			];
			this.list.setRows([]);
			return;
		}
		this.label(
			"fields",
			"Quantity                              Unit buyout (gold)",
			98,
		);
		this.visibleControls = [
			[
				this.input(this.quantityInput, "Quantity", 16, 122, 160),
				this.input(this.priceInput, "Unit buyout (gold)", 196, 122, 268),
			],
		];
		this.visibleControls.push(
			[12, 24, 48].map((hours, index) =>
				this.button(
					`duration-${hours}`,
					`${hours} hours`,
					16 + index * 152,
					166,
					144,
					this.duration === index + 1,
				),
			),
		);
		const deposit = this.client.getDeposit(this.sellQuantity, this.duration);
		this.label(
			"price",
			`Total: ${formatMoney(Number.isFinite(this.sellQuantity * this.sellPrice) ? Math.max(0, this.sellQuantity * this.sellPrice) : 0)}\nDeposit: ${deposit === undefined ? "Unavailable" : formatMoney(deposit)}`,
			206,
		);
		this.visibleControls.push([
			this.button("submit", "Post auction", 16, 246, 180),
			...(this.client.getPostConfirmation()
				? [this.button("confirm-post", "Confirm warning", 284, 246, 180)]
				: []),
		]);
		this.list.setRows(this.priceRows(true));
	}
	reset(): void {
		this.searchText = "";
		this.sellItem = undefined;
		this.setText(this.searchInput, "");
		this.setText(this.quantityInput, "1");
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Auction house requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.searchInput.configureTextInput((text) => {
			if (!this.writing) this.searchText = text;
		});
		this.quantityInput.configureTextInput((text) => {
			if (this.writing || !this.mounted) return;
			if (this.id === "auction-buy") this.client.setQuantity(Number(text));
			else this.sellQuantity = Number(text);
			this.refresh();
		});
		this.priceInput.configureTextInput((text) => {
			if (this.writing || !this.mounted) return;
			this.sellPriceEdited = true;
			this.sellPrice = Math.round(Number(text) * 10000);
			this.refresh();
		});
		this.mounted = true;
		if (this.id === "auction-owned") this.client.queryOwned();
		this.refresh();
		this.frame.show();
	}
	onUnmount(): void {
		this.mounted = false;
		this.layoutMode = undefined;
		this.generation++;
		this.searchInput.blurInput();
		this.quantityInput.blurInput();
		this.priceInput.blurInput();
		this.list.unmount();
		this.detailList.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.close();
	}
	getNavGrid(): NavGrid {
		return this.mounted
			? [
					...this.visibleControls.map((row) =>
						row.map((control) => control.nav),
					),
					...this.list.getNavGrid(),
					...this.detailList.getNavGrid(),
				]
			: [];
	}
	onBack(): void {
		if (this.id !== "auction-buy") return;
		if (this.client.getPurchase()) this.client.select();
		else {
			this.searchText = "";
			this.setText(this.searchInput, "");
			this.client.search("");
		}
		this.refresh();
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		this.detailList.destroy();
		for (const control of this.controls.values()) control.frame.destroy();
		this.searchInput.destroy();
		this.quantityInput.destroy();
		this.priceInput.destroy();
		this.frame.destroy();
	}
}
