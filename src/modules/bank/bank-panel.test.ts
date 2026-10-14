import { afterEach, expect, it, vi } from "vitest";
import type { IBankClient } from "../../clients/bank-client";
import type { InventoryItem } from "../../clients/inventory-client";
import { Frame } from "../../ui/components/frame";
import { FramePoolManager } from "../../ui/frame-pool-manager";
import { BagsPanel } from "../bags/bags-panel";
import { ItemGrouping } from "../bags/item-grouping";
import { BankPanel } from "./bank-panel";

afterEach(() => vi.restoreAllMocks());

function setup() {
	for (const method of [
		"fill",
		"setWindowBackground",
		"setButtonBackground",
		"setParent",
		"layout",
		"layoutVerticallyCentered",
		"setColor",
		"onClick",
		"inset",
		"onSizeChanged",
		"setScrollContent",
		"clampScroll",
		"setIcon",
		"onDragStart",
		"setItem",
		"onPostClick",
		"setCooldown",
		"setHoverTooltip",
		"show",
		"hide",
		"setLabel",
		"resetScroll",
		"setFocused",
		"destroy",
		"onClose",
		"setCloseButtonBackground",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const pool = new FramePoolManager({
		createFrame: () => {
			throw new Error("Unexpected native access");
		},
	});
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	};
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	const cloth: InventoryItem = {
		bagId: 12,
		slotId: 1,
		itemId: 42,
		iconFileId: 1,
		quality: 1,
		count: 100,
		category: "Reagents",
		expansionId: 10,
		stackable: true,
	};
	const items = [
		cloth,
		{ ...cloth, bagId: 16, count: 25 },
		{ ...cloth, itemId: 43, category: "Equipment" as const, stackable: false },
	];
	const state = {
		available: true,
		unlockedTabs: 2,
		maxTabs: 5,
		nextTabCost: 100000,
		canBuyTab: true,
		money: 2000000000,
		characterMoney: 1000000000,
		canDeposit: true,
		canWithdraw: true,
	};
	const client: IBankClient = {
		getState: vi.fn(() => state),
		getItems: vi.fn(() => items),
		setOpen: vi.fn(),
		select: vi.fn(),
		getDepositBankType: () => undefined,
		purchaseTab: vi.fn(),
		transferMoney: vi.fn(),
		close: vi.fn(),
		useItem: vi.fn(),
		pickupItem: vi.fn(),
	};
	const modal = { open: vi.fn(), close: vi.fn() };
	const grouping = new ItemGrouping();
	return {
		pool,
		scheduler,
		flush,
		client,
		modal,
		grouping,
		cloth,
		state,
		parent: new Frame("parent", pool),
	};
}

it("unifies tab stacks in the bag-sized two-column grid with a fixed bank footer and navigable transactions", () => {
	const { pool, scheduler, flush, client, modal, grouping, parent, cloth } =
		setup();
	const panel = new BankPanel(
		"warband",
		pool,
		client,
		modal,
		scheduler,
		grouping,
	);
	panel.refresh();
	expect(client.getItems).not.toHaveBeenCalled();
	panel.onMount(parent);
	flush();
	expect(client.select).toHaveBeenLastCalledWith("warband");
	expect(client.getItems).toHaveBeenLastCalledWith("warband");
	const labels = vi.mocked(Frame.prototype.setLabel);
	expect(labels.mock.calls).toContainEqual(
		expect.arrayContaining(["count", "125"]),
	);
	expect(
		labels.mock.calls.some((call) =>
			String(call.at(1)).includes("Tabs: 2 / 5"),
		),
	).toBe(true);
	const inset = vi.mocked(Frame.prototype.inset);
	expect(inset).toHaveBeenCalledWith(expect.any(Frame), 16, 58, 16, 112);
	const layout = vi.mocked(Frame.prototype.layout);
	expect(layout).toHaveBeenCalledWith(
		180,
		30,
		"TOPRIGHT",
		expect.any(Frame),
		-16,
		-24,
	);
	expect(layout.mock.calls).toContainEqual([
		226,
		24,
		"TOPLEFT",
		expect.any(Frame),
		234,
		-0,
	]);
	expect(
		layout.mock.calls.some((call) => call.at(0) === 42 && call.at(1) === 42),
	).toBe(true);
	const nav = panel.getNavGrid().flat();
	const footerRows = panel
		.getNavGrid()
		.filter((row) =>
			row.some(
				(node) =>
					node.navId.endsWith("buy-tab") || node.navId.endsWith("deposit"),
			),
		);
	expect(footerRows).toHaveLength(2);
	expect(footerRows.at(0)?.at(0)?.navColumn).toBe(7);
	expect(footerRows.at(1)?.map((node) => node.navColumn)).toEqual([0, 3]);
	expect(nav.filter((node) => node.navId.includes("item-"))).toHaveLength(2);
	nav.find((node) => node.navId.includes("item-42"))?.onAlternate?.();
	expect(client.useItem).toHaveBeenCalledExactlyOnceWith(cloth);
	nav.find((node) => node.navId.endsWith("buy-tab"))?.onInteract();
	expect(modal.open).toHaveBeenCalledWith(
		expect.stringContaining("Buy next"),
		expect.any(Array),
	);
	nav.find((node) => node.navId.endsWith("deposit"))?.onInteract();
	expect(modal.open).toHaveBeenLastCalledWith(
		"Deposit gold",
		expect.any(Array),
	);
	nav.find((node) => node.navId.endsWith("withdraw"))?.onInteract();
	expect(modal.open).toHaveBeenLastCalledWith(
		"Withdraw gold",
		expect.any(Array),
	);
	const parents = vi.mocked(Frame.prototype.setParent);
	expect(
		parents.mock.contexts.some(
			(frame, index) =>
				frame.id.endsWith("footer") &&
				parents.mock.calls.at(index)?.at(0)?.id === "warband-bank-frame",
		),
	).toBe(true);
	panel.onUnmount();
	expect(panel.getNavGrid()).toEqual([]);
	vi.mocked(client.getItems).mockClear();
	panel.refresh();
	expect(client.getItems).not.toHaveBeenCalled();
});

it("keeps the next-tab button visible when unaffordable but excludes it from navigation and prevents purchase", () => {
	const { pool, scheduler, flush, client, modal, grouping, parent, state } =
		setup();
	state.canBuyTab = false;
	const panel = new BankPanel(
		"standard",
		pool,
		client,
		modal,
		scheduler,
		grouping,
	);
	panel.onMount(parent);
	flush();
	expect(
		vi
			.mocked(Frame.prototype.show)
			.mock.contexts.some((frame) => frame.id === "bank-buy-tab"),
	).toBe(true);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.endsWith("buy-tab")),
	).toBe(false);
	expect(modal.open).not.toHaveBeenCalled();
});

it("syncs category versus expansion between bags and both banks, including hidden views", () => {
	const { pool, scheduler, flush, client, modal, grouping, parent } = setup();
	const bags = new BagsPanel(
		"bags",
		"Bags",
		new Frame("bags-frame", pool),
		pool,
		client,
		{ open: vi.fn(), close: vi.fn() },
		scheduler,
		grouping,
	);
	const bank = new BankPanel(
		"standard",
		pool,
		client,
		modal,
		scheduler,
		grouping,
	);
	bags.onMount(parent);
	bank.onMount(parent);
	flush();
	bags.getNavGrid().at(0)?.at(0)?.onInteract();
	flush();
	expect(grouping.mode).toBe("expansion");
	expect(vi.mocked(Frame.prototype.setLabel).mock.calls).toContainEqual([
		"mode",
		"Group: Expansion",
	]);
	expect(
		vi
			.mocked(Frame.prototype.setLabel)
			.mock.calls.some((call) => call.at(1) === "The War Within"),
	).toBe(true);
	bank.onUnmount();
	bags.getNavGrid().at(0)?.at(0)?.onInteract();
	flush();
	bank.onMount(parent);
	flush();
	expect(grouping.mode).toBe("category");
	expect(
		bank
			.getNavGrid()
			.flat()
			.some((node) => node.navId.endsWith("deposit")),
	).toBe(false);
	const layouts = vi.mocked(Frame.prototype.layout).mock.calls.length;
	bank.onUnmount();
	bank.onMount(parent);
	flush();
	expect(
		vi.mocked(Frame.prototype.layout).mock.calls.length - layouts,
	).toBeLessThan(15);
});
