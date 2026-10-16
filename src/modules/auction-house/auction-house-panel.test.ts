import { expect, it, vi } from "vitest";
import type { IAuctionHouseClient } from "../../clients/auction-house-client";
import { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { AuctionHousePanel } from "./auction-house-panel";

const { rows, inputs, labels, instances, hides, skins, borders, widths } =
	vi.hoisted(() => ({
		rows: new Map<string, readonly ListRow[]>(),
		inputs: new Map<string, (text: string) => void>(),
		labels: new Map<string, string[]>(),
		instances: [] as string[],
		hides: new Map<string, number>(),
		skins: new Map<string, string>(),
		borders: new Map<string, readonly number[]>(),
		widths: new Map<string, number>(),
	}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			instances.push(id);
		}
		fill() {}
		setParent() {}
		layout(width: number) {
			widths.set(this.id, width);
		}
		show() {}
		hide() {
			hides.set(this.id, (hides.get(this.id) ?? 0) + 1);
		}
		destroy() {}
		blurInput() {}
		setWindowBackground() {}
		setButtonBackground() {
			skins.set(this.id, "red");
		}
		setInsetBackground() {
			skins.set(this.id, "inset");
		}
		setColor() {
			skins.set(this.id, "plain");
		}
		setBorder(color: readonly number[]) {
			borders.set(this.id, color);
		}
		setFocused() {}
		focusInput() {}
		onClick() {}
		setLabel(_key: string, text: string) {
			const values = labels.get(this.id) ?? [];
			values.push(text);
			labels.set(this.id, values);
		}
		configureTextInput(change: (text: string) => void) {
			inputs.set(this.id, change);
		}
		setInputText() {}
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(
			readonly id: string,
			_pool: unknown,
			_title: unknown,
			_close: unknown,
			options: { bottom: number },
		) {
			widths.set(`${id}-bottom`, options.bottom);
		}
		mount() {}
		unmount() {}
		destroy() {}
		setRows(value: readonly ListRow[]) {
			rows.set(this.id, value);
		}
		getNavGrid() {
			return (rows.get(this.id) ?? [])
				.filter((row) => !row.heading && row.enabled !== false)
				.map((row) => [
					{
						navId: row.id,
						onFocus() {},
						onBlur() {},
						onInteract: row.activate,
					},
				]);
		}
	},
}));
function setup(
	id: "auction-buy" | "auction-sell" | "auction-owned" = "auction-buy",
) {
	const token = {
		name: "WoW Token",
		token: true,
		key: { itemID: 122284 },
		icon: 1,
		price: 500,
		quantity: 1,
	};
	const item = {
		name: "Ore",
		key: { itemID: 123 },
		icon: 2,
		commodity: true,
		price: 100,
		quantity: 200,
	};
	let purchase:
		| {
				item: typeof item;
				quantity: number;
				unit: number;
				total: number;
				ready: boolean;
		  }
		| undefined;
	const client = {
		getBrowse: () => [token, item],
		getPurchase: () => purchase,
		select: vi.fn((selected) => {
			purchase = selected
				? { item: selected, quantity: 1, unit: 100, total: 100, ready: true }
				: undefined;
		}),
		setQuantity: vi.fn((quantity: number) => {
			if (purchase) purchase = { ...purchase, quantity, total: quantity * 100 };
		}),
		getListings: () => [{ id: 1, quantity: 200, unitPrice: 100, total: 20000 }],
		buy: vi.fn(),
		search: vi.fn(),
		getStatus: () => "",
		toggleFavorite: vi.fn(),
		loadMore: vi.fn(),
		getSellItem: () => item,
		getDeposit: () => 50,
		post: vi.fn(),
		confirmPost: vi.fn(),
		getPostConfirmation: () => undefined,
		getOwned: () => [
			{
				id: 9,
				name: "Ore",
				quantity: 20,
				total: 2000,
				sold: false,
				secondsLeft: 3600,
			},
		],
		queryOwned: vi.fn(),
	} as unknown as IAuctionHouseClient;
	const pool = {} as IFramePoolManager;
	const panel = new AuctionHousePanel(id, pool, client, vi.fn());
	panel.onMount(new Frame("parent", pool));
	return { panel, client };
}
it("uses plain browse rows and navigation, neutral selectors, and compact primary actions", () => {
	const { panel } = setup();
	expect(
		rows.get("auction-buy-list")?.every((row) => row.background === false),
	).toBe(true);
	expect(skins.get("auction-buy-more")).toBe("plain");
	expect(instances).not.toContain("auction-buy-scroll--1");
	expect(widths.get("auction-buy-list-bottom")).toBe(16);
	expect(widths.get("auction-buy-prices-bottom")).toBe(16);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.includes("scroll-")),
	).toBe(false);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-item-123-0-0-0")
		?.onInteract();
	expect(skins.get("auction-buy-amount-20")).toBe("inset");
	expect(skins.get("auction-buy-back")).toBe("plain");
	expect(skins.get("auction-buy-submit")).toBe("red");
	expect(widths.get("auction-buy-submit")).toBeLessThanOrEqual(200);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-buy-amount-20")
		?.onInteract();
	expect(borders.get("auction-buy-amount-20")).toEqual([1, 0.82, 0, 1]);
	setup("auction-sell");
	expect(skins.get("auction-sell-duration-24")).toBe("inset");
	expect(borders.get("auction-sell-duration-24")).toEqual([1, 0.82, 0, 1]);
});
it("lands on the token and favourites, opens item details, and buys only from the separate button", () => {
	const { panel, client } = setup();
	expect(rows.get("auction-buy-list")?.at(0)?.label).toBe("WoW Token");
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-item-123-0-0-0")
		?.onInteract();
	for (const quantity of [1, 10, 20, 50, 200]) {
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === `auction-buy-amount-${quantity}`)
			?.onInteract();
		expect(client.setQuantity).toHaveBeenLastCalledWith(quantity);
		expect(client.buy).not.toHaveBeenCalled();
	}
	inputs.get("auction-buy-quantity")?.("17");
	expect(client.setQuantity).toHaveBeenLastCalledWith(17);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.includes("listing")),
	).toBe(false);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-buy-submit")
		?.onInteract();
	expect(client.buy).toHaveBeenCalledOnce();
	expect(
		labels.get("auction-buy-root")?.some((label) => label.includes("Total:")),
	).toBe(true);
});
it("searches specific items and returns to favourites", () => {
	const { panel, client } = setup();
	inputs.get("auction-buy-search")?.("Ore");
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-buy-search-submit")
		?.onInteract();
	expect(client.search).toHaveBeenCalledWith("Ore");
	panel.onBack();
	expect(client.search).toHaveBeenLastCalledWith("");
});

it("keeps the quantity input visible while typing multiple digits", () => {
	const { panel } = setup();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-item-123-0-0-0")
		?.onInteract();
	const before = hides.get("auction-buy-quantity");
	inputs.get("auction-buy-quantity")?.("1");
	inputs.get("auction-buy-quantity")?.("17");
	expect(hides.get("auction-buy-quantity")).toBe(before);
});
it("stacks selling controls above informational prices and provides only owned auctions", () => {
	const { panel, client } = setup("auction-sell");
	inputs.get("auction-sell-price")?.("1.25");
	inputs.get("auction-sell-quantity")?.("10");
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-sell-submit")
		?.onInteract();
	expect(client.post).toHaveBeenCalledWith(10, 12500, 2);
	expect(rows.get("auction-sell-list")?.every((row) => row.heading)).toBe(true);
	const owned = setup("auction-owned");
	expect(rows.get("auction-owned-list")?.at(0)?.label).toContain("Ore");
	expect(
		owned.panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.includes("bid")),
	).toBe(false);
});

it("uses the market price for token sales and offers no editable token price", () => {
	const { panel, client } = setup("auction-sell");
	const item = client.getSellItem();
	if (!item) throw new Error("Missing sell item");
	vi.spyOn(client, "getSellItem").mockReturnValue({
		...item,
		token: true,
		price: 999,
	});
	panel.refresh();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "auction-sell-price"),
	).toBe(false);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-sell-submit")
		?.onInteract();
	expect(client.post).toHaveBeenCalledWith(1, 999, 2);
});
it("prefills the market price when sell results arrive, then preserves a manually entered price", () => {
	const { panel, client } = setup("auction-sell");
	vi.spyOn(client, "getListings").mockReturnValue([
		{ id: 1, quantity: 20, unitPrice: 500, total: 10000 },
	]);
	panel.refresh();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-sell-submit")
		?.onInteract();
	expect(client.post).toHaveBeenLastCalledWith(1, 500, 2);
	inputs.get("auction-sell-price")?.("2");
	vi.spyOn(client, "getListings").mockReturnValue([
		{ id: 1, quantity: 20, unitPrice: 700, total: 14000 },
	]);
	panel.refresh();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "auction-sell-submit")
		?.onInteract();
	expect(client.post).toHaveBeenLastCalledWith(1, 20000, 2);
});
it("reuses controls across mounts and ignores actions after unmount", () => {
	const { panel, client } = setup();
	const node = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId.includes("auction-item-123"));
	panel.onUnmount();
	node?.onInteract();
	expect(client.select).not.toHaveBeenCalled();
	const count = instances.length;
	panel.onMount(new Frame("parent2", {} as IFramePoolManager));
	expect(instances.length).toBe(count + 1);
});
