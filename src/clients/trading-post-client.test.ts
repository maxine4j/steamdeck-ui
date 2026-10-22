import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { Frame } from "../ui/components/frame";
import { NavigationManager } from "../ui/navigation/navigation-manager";
import { TradingPostClient } from "./trading-post-client";

afterEach(() => vi.unstubAllGlobals());

function setup(loaded = true) {
	const hooks = new Map<string, () => void>();
	function button() {
		const scripts = {
			OnEnter: vi.fn(),
			OnLeave: vi.fn(),
			OnDragStart: vi.fn(),
		};
		return {
			IsVisible: vi.fn(() => true),
			IsEnabled: vi.fn(() => true),
			IsProtected: () => false,
			Click: vi.fn(),
			GetScript: (name: keyof typeof scripts) => scripts[name],
			HookScript: vi.fn(),
			scripts,
		};
	}
	const first = button(),
		last = button(),
		purchase = button(),
		filter = button();
	const menuItem = button();
	let menuOpen = false;
	const dropdown = {
		...filter,
		OpenMenu: vi.fn(() => {
			menuOpen = true;
		}),
		CloseMenu: vi.fn(() => {
			menuOpen = false;
		}),
		IsMenuOpen: () => menuOpen,
		menu: { IsVisible: () => menuOpen, GetChildren: () => [menuItem] },
	};
	const data = [
		{ isHeaderInfo: true },
		{ isItemInfo: true, perksVendorItemID: 11 },
		{ isItemInfo: true, perksVendorItemID: 22 },
	];
	let realized = data.at(1);
	const scroll = {
		GetDataProvider: () => ({ GetCollection: () => data }),
		ScrollToNearest: vi.fn((index: number) => {
			realized = data.at(index - 1);
		}),
		FindFrame: vi.fn((item) =>
			item === realized ? (item === data.at(1) ? first : last) : undefined,
		),
	};
	const frame = {
		IsShown: vi.fn(() => true),
		GetSize: () => [1000, 600],
		HookScript: (name: string, callback: () => void) =>
			hooks.set(name, callback),
		ProductsFrame: {
			PerksProgramFilter: dropdown,
			ProductsScrollBoxContainer: {
				ScrollBox: scroll,
				NameSortButton: button(),
				PriceSortButton: button(),
				TimeSortButton: button(),
			},
		},
		FooterFrame: { PurchaseButton: purchase, LeaveButton: button() },
	};
	const globals: Record<string, unknown> = {
		PerksProgramFrame: loaded ? frame : undefined,
	};
	vi.stubGlobal("_G", globals);
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.set(String(args.at(-2)), args.at(-1) as () => void),
	);
	vi.stubGlobal(
		"HideUIPanel",
		vi.fn(() => frame.IsShown.mockReturnValue(false)),
	);
	const events = createTestEventBus();
	const changed = vi.fn(),
		visibility = vi.fn();
	events.subscribe("TRADING_POST_CHANGED", changed);
	events.subscribe("TRADING_POST_VISIBILITY_CHANGED", visibility);
	const navigation = {
		navigation: vi.fn((_frame, _scroll, navId, onInteract, hover) => ({
			navId,
			onInteract,
			onFocus: vi.fn(() => hover?.enter()),
			onBlur: vi.fn(() => hover?.leave()),
		})),
		release: vi.fn(),
	};
	const layout = { bind: vi.fn(), release: vi.fn() };
	const client = new TradingPostClient(events, layout, navigation);
	const parent = { getSize: () => ({ width: 1200, height: 720 }) } as Frame;
	return {
		client,
		frame,
		globals,
		hooks,
		first,
		last,
		purchase,
		dropdown,
		menuItem,
		data,
		scroll,
		events,
		changed,
		visibility,
		navigation,
		layout,
		parent,
	};
}

it("builds a logical grid including unrealized products, reveals them on focus, and selects through native buttons", () => {
	const s = setup();
	s.client.mount(s.parent);
	expect(
		s.client.navigation().map((row) => row.map((node) => node.navId)),
	).toEqual([
		["trading-post-filter"],
		[
			"trading-post-sort-name",
			"trading-post-sort-price",
			"trading-post-sort-time",
		],
		["trading-post-product-11"],
		["trading-post-product-22"],
		["trading-post-leave", "trading-post-purchase"],
	]);
	const manager = new NavigationManager(s.events);
	manager.registerGrid("trading-post", () => s.client.navigation());
	manager.setActiveGrid("trading-post");
	manager.moveDown();
	manager.moveDown();
	expect(manager.focusedId).toBe("trading-post-product-11");
	manager.moveDown();
	expect(manager.focusedId).toBe("trading-post-product-22");
	expect(s.scroll.ScrollToNearest).toHaveBeenLastCalledWith(3, undefined, true);
	expect(s.last.scripts.OnEnter).toHaveBeenCalledOnce();
	manager.interact();
	expect(s.last.Click).toHaveBeenCalledWith("LeftButton");
	manager.refreshGrid("trading-post");
	expect(manager.focusedId).toBe("trading-post-product-22");
	expect(s.last.scripts.OnEnter).toHaveBeenCalledOnce();
	manager.moveDown();
	expect(s.last.scripts.OnLeave).toHaveBeenCalledOnce();
	manager.destroy();
});

it("excludes unavailable actions, rechecks activation and traps the native filter menu until cancelled", () => {
	const s = setup();
	s.client.mount(s.parent);
	s.purchase.IsEnabled.mockReturnValue(false);
	expect(
		s.client
			.navigation()
			.flat()
			.map((node) => node.navId),
	).not.toContain("trading-post-purchase");
	s.purchase.IsEnabled.mockReturnValue(true);
	const purchase = s.client
		.navigation()
		.flat()
		.find((node) => node.navId === "trading-post-purchase");
	s.purchase.IsVisible.mockReturnValue(false);
	purchase?.onInteract();
	expect(s.purchase.Click).not.toHaveBeenCalled();
	s.client.navigation().at(0)?.at(0)?.onInteract();
	expect(s.dropdown.OpenMenu).toHaveBeenCalledOnce();
	const menu = s.client.navigation().flat();
	expect(menu).toHaveLength(1);
	menu.at(0)?.onInteract();
	expect(s.menuItem.Click).toHaveBeenCalledWith("LeftButton");
	expect(s.client.dismissMenus()).toBe(true);
	expect(s.client.dismissMenus()).toBe(false);
});

it("attaches to lazy-loaded UI, fits it inside the host, publishes changes and restores it cleanly", () => {
	const s = setup(false);
	s.client.disable();
	expect(s.client.isOpen()).toBe(false);
	s.globals.PerksProgramFrame = s.frame;
	s.hooks.get("ShowUIPanel")?.();
	expect(s.client.isOpen()).toBe(true);
	expect(s.visibility).toHaveBeenCalled();
	s.client.mount(s.parent);
	expect(s.layout.bind).toHaveBeenCalledWith(
		s.frame,
		expect.objectContaining({
			parent: s.parent,
			reparent: true,
			size: [1000, 600],
			scale: 1.2,
		}),
	);
	s.hooks.get("OnEvent")?.();
	expect(s.changed).toHaveBeenCalled();
	s.client.restore();
	expect(HideUIPanel).toHaveBeenCalledWith(s.frame);
	expect(s.layout.release).toHaveBeenCalledOnce();
	expect(s.navigation.release).toHaveBeenCalledOnce();
	expect(s.client.navigation()).toEqual([]);
	s.changed.mockClear();
	s.visibility.mockClear();
	s.hooks.get("OnEvent")?.();
	s.hooks.get("OnShow")?.();
	expect(s.changed).not.toHaveBeenCalled();
	expect(s.visibility).not.toHaveBeenCalled();
});

it("reveals a preserved product after Blizzard recycles its row during sorting", () => {
	const s = setup();
	s.client.mount(s.parent);
	const node = s.client
		.navigation()
		.flat()
		.find((item) => item.navId === "trading-post-product-22");
	node?.onFocus();
	s.scroll.ScrollToNearest(2);
	s.client.navigation();
	node?.onFocus(true);
	expect(s.scroll.ScrollToNearest).toHaveBeenLastCalledWith(3, undefined, true);
	const [, , , interact] = s.navigation.navigation.mock.lastCall ?? [];
	interact?.();
	expect(s.last.Click).toHaveBeenCalledOnce();
});

it("activates model rotation using Blizzard mouse scripts when a native control has no click script", () => {
	const s = setup();
	const down = vi.fn(),
		up = vi.fn();
	const rotate = {
		...s.first,
		GetScript: (name: string) =>
			name === "OnMouseDown" ? down : name === "OnMouseUp" ? up : undefined,
	};
	Object.assign(s.frame.FooterFrame, {
		RotateButtonContainer: { RotateLeftButton: rotate },
	});
	s.client.mount(s.parent);
	s.client
		.navigation()
		.flat()
		.find((node) => node.navId === "trading-post-rotate-left")
		?.onInteract();
	expect(down).toHaveBeenCalledWith(rotate);
	expect(up).toHaveBeenCalledWith(rotate);
	expect(rotate.Click).not.toHaveBeenCalled();
});

it("freezes the focused product through native drag/drop handlers, preserving native confirmation and rejecting unavailable targets", () => {
	const s = setup();
	const calls: string[] = [];
	s.first.scripts.OnDragStart.mockImplementation(() => calls.push("pickup"));
	const frozen = {
		...s.last,
		Click: vi.fn(() => calls.push("native-freeze-confirmation")),
	};
	Object.assign(s.frame.ProductsFrame, {
		FrozenProductContainer: { ProductButton: frozen },
	});
	s.client.mount(s.parent);
	const product = s.client
		.navigation()
		.flat()
		.find((node) => node.navId === "trading-post-product-11");
	product?.onFocus();
	product?.onContext?.();
	expect(calls).toEqual(["pickup", "native-freeze-confirmation"]);
	calls.length = 0;
	frozen.IsVisible.mockReturnValue(false);
	product?.onContext?.();
	expect(calls).toEqual([]);
	frozen.IsVisible.mockReturnValue(true);
	Object.assign(s.data.at(1) ?? {}, { purchased: true });
	product?.onContext?.();
	expect(calls).toEqual([]);
});
