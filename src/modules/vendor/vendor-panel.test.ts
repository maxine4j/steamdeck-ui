import { expect, it, vi } from "vitest";
import type { IVendorClient, VendorItem } from "../../clients/vendor-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { VendorPanel } from "./vendor-panel";

const { labels, layouts, clicks } = vi.hoisted(() => ({
	labels: new Map<string, ReturnType<typeof vi.fn>>(),
	layouts: new Map<string, ReturnType<typeof vi.fn>>(),
	clicks: new Map<string, ReturnType<typeof vi.fn>>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			labels.set(id, this.setLabel);
			layouts.set(id, this.layout);
			clicks.set(id, this.onClick);
		}
		setLabel = vi.fn();
		layout = vi.fn();
		onClick = vi.fn();
		setParent = vi.fn();
		fill = vi.fn();
		setBlackBackground = vi.fn();
		setIcon = vi.fn();
		setColor = vi.fn();
		setTooltip = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		inset = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		revealVerticalRange = vi.fn();
	},
}));
function setup() {
	const items: VendorItem[] = Array.from({ length: 11 }, (_, index) => ({
		index: index + 1,
		name: `Item ${index + 1}`,
		icon: 1,
		price: 12345,
		count: 2,
		available: -1,
		purchasable: true,
		costs: [],
	}));
	const client: IVendorClient = {
		setOpen: vi.fn(),
		getItems: vi.fn(() => items),
		getBuyback: vi.fn(() => items.slice(0, 1)),
		getActions: vi.fn(() => ({
			repairCost: 12345,
			repair: true,
			guildRepair: true,
			sellJunk: true,
		})),
		buy: vi.fn(),
		buyback: vi.fn(),
		repair: vi.fn(),
		sellJunk: vi.fn(),
		ensureBagsOpen: vi.fn(),
		close: vi.fn(),
	};
	const pool = {} as IFramePoolManager;
	return { pool, client, items, parent: new Frame("parent", pool) };
}

it("stacks vendor pages in two columns, exposes purchase actions and reuses controls", () => {
	const { pool, client, parent, items } = setup();
	const close = vi.fn();
	const panel = new VendorPanel("vendor", pool, client, close);
	panel.onMount(parent);
	expect(labels.get("vendor-items-cell-0")).toHaveBeenCalledWith(
		"detail",
		"1g 23s 45c",
		"BOTTOMLEFT",
		56,
		6,
		11,
		164,
	);
	expect(labels.get("vendor-items-header-0")).toHaveBeenCalledWith(
		"label",
		"Page 1",
		"LEFT",
		0,
		0,
		15,
		460,
	);
	expect(labels.get("vendor-items-header-1")).toHaveBeenCalledWith(
		"label",
		"Page 2",
		"LEFT",
		0,
		0,
		15,
		460,
	);
	expect(
		layouts.get("vendor-items-cell-10")?.mock.calls.at(-1)?.slice(-2),
	).toEqual([0, -398]);
	expect(
		panel
			.getNavGrid()
			.slice(0, 6)
			.map((row) => row.length),
	).toEqual([2, 2, 2, 2, 2, 1]);
	panel.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(client.buy).toHaveBeenCalledWith(items.at(0));
	const count = layouts.size;
	panel.onUnmount();
	expect(panel.getNavGrid()).toEqual([]);
	panel.onMount(parent);
	expect(layouts.size).toBe(count);
	panel.onContainerClosed();
	expect(close).toHaveBeenCalledOnce();
});

it("routes repair and junk controls, guards unavailable actions, and isolates buyback", () => {
	const { pool, client, parent, items } = setup();
	const panel = new VendorPanel("vendor", pool, client, vi.fn());
	panel.onMount(parent);
	const footer = panel.getNavGrid().at(-2);
	footer?.at(0)?.onInteract();
	footer?.at(1)?.onInteract();
	footer?.at(2)?.onInteract();
	expect(client.repair.mock.calls).toEqual([[false], [true]]);
	expect(client.sellJunk).toHaveBeenCalledOnce();
	vi.mocked(client.getActions).mockReturnValue({
		repairCost: 12345,
		repair: false,
		guildRepair: false,
		sellJunk: false,
	});
	panel.refresh();
	footer?.at(0)?.onInteract();
	footer?.at(1)?.onInteract();
	footer?.at(2)?.onInteract();
	expect(client.repair).toHaveBeenCalledTimes(2);
	expect(client.sellJunk).toHaveBeenCalledOnce();
	panel.onUnmount();
	const buyback = new VendorPanel("buyback", pool, client, vi.fn());
	buyback.onMount(parent);
	expect(buyback.getNavGrid()).toHaveLength(2);
	buyback.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(client.buyback).toHaveBeenCalledWith(items.at(0));
});

it("retains page boundaries when some merchant item data is unavailable", () => {
	const { pool, client, parent, items } = setup();
	const first = items.at(0);
	const secondPage = items.at(10);
	if (!first || !secondPage) throw new Error("Expected two pages");
	vi.mocked(client.getItems).mockReturnValue([first, secondPage]);
	const panel = new VendorPanel("vendor", pool, client, vi.fn());
	panel.onMount(parent);
	expect(labels.get("vendor-items-header-1")).toHaveBeenCalledWith(
		"label",
		"Page 2",
		"LEFT",
		0,
		0,
		15,
		460,
	);
});
