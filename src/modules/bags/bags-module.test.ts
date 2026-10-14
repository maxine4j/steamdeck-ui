import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BagsModule } from "./bags-module";

it("starts closed, follows native bag visibility, and restores built-in bags on shutdown", () => {
	const events = createTestEventBus();
	const ui = {
		openPanel: vi.fn(),
		closePanel: vi.fn(),
		registerPanel: vi.fn(),
		getContainer: vi.fn(),
	};
	const inventory = {
		useItem: vi.fn(),
		pickupItem: vi.fn(),
		destroyItem: vi.fn(),
		getItems: vi.fn(() => []),
		getMoney: vi.fn(() => 12345),
		isOpen: vi.fn(() => false),
	};
	let visibilityChanged: ((visible: boolean) => void) | undefined;
	const view = {
		refreshInteractions: vi.fn(),
		refreshCooldowns: vi.fn(),
		setItems: vi.fn(),
		setMoney: vi.fn(),
		setVisibilityChanged: (callback?: (visible: boolean) => void) => {
			visibilityChanged = callback;
		},
	};
	const builtIn = { disable: vi.fn(), restore: vi.fn() };
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
	const module = new BagsModule(
		ui,
		events,
		inventory,
		view,
		builtIn,
		scheduler,
	);
	module.disableBuiltIn();
	module.initialize();
	expect(builtIn.disable).toHaveBeenCalledOnce();
	expect(view.setMoney).toHaveBeenLastCalledWith(12345);
	inventory.getMoney.mockReturnValue(67890);
	events.emit("PLAYER_MONEY");
	expect(view.setMoney).toHaveBeenLastCalledWith(67890);
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(inventory.getItems).not.toHaveBeenCalled();
	expect(ui.openPanel).not.toHaveBeenCalled();
	// Selecting Bags from another tab must load without native bags opening.
	visibilityChanged?.(true);
	events.emit("INVENTORY_ITEM_USE_TARGET_CHANGED");
	expect(view.refreshInteractions).toHaveBeenCalledOnce();
	expect(inventory.getItems).toHaveBeenCalledOnce();
	expect(ui.openPanel).not.toHaveBeenCalled();
	events.emit("BAG_COOLDOWNS_CHANGED");
	expect(view.refreshCooldowns).toHaveBeenCalledOnce();
	expect(inventory.getItems).toHaveBeenCalledOnce();
	view.refreshCooldowns.mockClear();
	visibilityChanged?.(false);
	events.emit("BAG_COOLDOWNS_CHANGED");
	expect(view.refreshCooldowns).not.toHaveBeenCalled();
	visibilityChanged?.(true);
	expect(inventory.getItems).toHaveBeenCalledOnce();
	events.emit("BAG_UPDATE_DELAYED");
	pending.shift()?.();
	expect(inventory.getItems).toHaveBeenCalledTimes(2);
	visibilityChanged?.(false);
	events.emit("BAG_UPDATE_DELAYED");
	expect(pending).toHaveLength(0);
	inventory.getItems.mockClear();
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("bags", "right");
	expect(inventory.getItems).toHaveBeenCalledOnce();
	inventory.isOpen.mockReturnValue(false);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("right");
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(inventory.getItems).toHaveBeenCalledOnce();
	inventory.isOpen.mockReturnValue(false);
	events.emit("BAG_VISIBILITY_CHANGED");
	events.emit("BAG_UPDATE_DELAYED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(inventory.getItems).toHaveBeenCalledOnce();
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(inventory.getItems).toHaveBeenCalledTimes(2);
	events.emit("ITEM_DATA_LOAD_RESULT");
	events.emit("ITEM_DATA_LOAD_RESULT");
	events.emit("BAG_UPDATE_DELAYED");
	expect(inventory.getItems).toHaveBeenCalledTimes(2);
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(inventory.getItems).toHaveBeenCalledTimes(3);
	events.emit("BAG_UPDATE_DELAYED");
	module.shutdown();
	events.emit("BAG_COOLDOWNS_CHANGED");
	expect(view.refreshCooldowns).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(inventory.getItems).toHaveBeenCalledTimes(3);
	expect(builtIn.restore).toHaveBeenCalledOnce();
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledTimes(3);
});
