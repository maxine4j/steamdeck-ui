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
		getItems: vi.fn(() => []),
		getMoney: vi.fn(() => 12345),
		isOpen: vi.fn(() => false),
	};
	const view = { setItems: vi.fn(), setMoney: vi.fn() };
	const builtIn = { disable: vi.fn(), restore: vi.fn() };
	const module = new BagsModule(ui, events, inventory, view, builtIn);
	module.disableBuiltIn();
	module.initialize();
	expect(builtIn.disable).toHaveBeenCalledOnce();
	expect(view.setMoney).toHaveBeenLastCalledWith(12345);
	inventory.getMoney.mockReturnValue(67890);
	events.emit("PLAYER_MONEY");
	expect(view.setMoney).toHaveBeenLastCalledWith(67890);
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(inventory.getItems).toHaveBeenCalledTimes(2);
	expect(ui.openPanel).not.toHaveBeenCalled();
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("bags", "right");
	inventory.isOpen.mockReturnValue(false);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("right");
	module.shutdown();
	expect(builtIn.restore).toHaveBeenCalledOnce();
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledOnce();
});
