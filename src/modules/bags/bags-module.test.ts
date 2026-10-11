import { expect, it, vi } from "vitest";
import { EventBus } from "../../events/event-bus";
import { BagsModule } from "./bags-module";

it("starts closed, follows native bag visibility, and restores built-in bags on shutdown", () => {
	const events = new EventBus();
	const ui = {
		openPanel: vi.fn(),
		closePanel: vi.fn(),
		registerPanel: vi.fn(),
		getContainer: vi.fn(),
	};
	const inventory = { getItems: vi.fn(() => []), isOpen: vi.fn(() => false) };
	const view = { setItems: vi.fn() };
	const builtIn = { disable: vi.fn(), restore: vi.fn() };
	const module = new BagsModule(ui, events, inventory, view, builtIn);
	module.disableBuiltIn();
	module.initialize();
	expect(builtIn.disable).toHaveBeenCalledOnce();
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
