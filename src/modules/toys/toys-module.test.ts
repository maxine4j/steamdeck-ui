import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { ToysModule } from "./toys-module";

it("opens toys on the right, refreshes data and cooldowns separately, and restores built-in UI", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn(), refreshCooldowns: vi.fn(), resume: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => true),
	};
	const module = new ToysModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	expect(native.disable).toHaveBeenCalledOnce();
	expect(ui.openPanel).toHaveBeenCalledWith("toys", "right");
	native.isOpen.mockReturnValue(false);
	events.emit("TOYS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("right", "toys");
	events.emit("TOYS_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(view.refresh).toHaveBeenCalledTimes(2);
	events.emit("TOYS_COOLDOWN_CHANGED");
	expect(view.refreshCooldowns).toHaveBeenCalledOnce();
	events.emit("COMBAT_ENDED");
	expect(view.resume).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("TOYS_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	events.emit("TOYS_COOLDOWN_CHANGED");
	expect(view.refresh).toHaveBeenCalledTimes(2);
	expect(view.refreshCooldowns).toHaveBeenCalledTimes(1);
	expect(native.restore).toHaveBeenCalledOnce();
});
