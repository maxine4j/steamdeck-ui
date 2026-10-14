import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { ToysModule } from "./toys-module";

it("opens toys on the right, refreshes data and cooldowns separately, and restores built-in UI", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = {
		invalidate: vi.fn(),
		refreshCooldowns: vi.fn(),
		resume: vi.fn(),
	};
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => true),
	};
	const module = new ToysModule(ui, events, view, native, {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
		refreshEntry: vi.fn(),
		refreshItem: vi.fn(),
		stop: vi.fn(),
	});
	module.disableBuiltIn();
	module.initialize();
	expect(native.disable).toHaveBeenCalledOnce();
	expect(ui.openPanel).toHaveBeenCalledWith("toys", "right");
	native.isOpen.mockReturnValue(false);
	events.emit("TOYS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("right", "toys");
	events.emit("TOYS_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(view.invalidate).not.toHaveBeenCalled();
	events.emit("TOYS_COOLDOWN_CHANGED");
	expect(view.refreshCooldowns).toHaveBeenCalledOnce();
	events.emit("COMBAT_ENDED");
	expect(view.resume).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("TOYS_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	events.emit("TOYS_COOLDOWN_CHANGED");
	expect(view.invalidate).not.toHaveBeenCalled();
	expect(view.refreshCooldowns).toHaveBeenCalledTimes(1);
	expect(native.restore).toHaveBeenCalledOnce();
});

it("warms the toy journal at initialization and invalidates item metadata before refreshing", () => {
	const events = createTestEventBus();
	const journal = {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
		refreshEntry: vi.fn(),
		refreshItem: vi.fn(),
		stop: vi.fn(),
	};
	const module = new ToysModule(
		{ openPanel: vi.fn(), closePanel: vi.fn() },
		events,
		{ invalidate: vi.fn(), refreshCooldowns: vi.fn(), resume: vi.fn() },
		{ disable: vi.fn(), restore: vi.fn(), isOpen: () => false },
		journal,
	);
	module.initialize();
	expect(journal.prefetch).toHaveBeenCalledOnce();
	events.emit("TOYS_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(journal.refreshEntry).toHaveBeenCalledOnce();
	events.emit("TOYS_CHANGED", { id: 42 });
	expect(journal.refreshEntry).toHaveBeenLastCalledWith(42);
	module.shutdown();
	expect(journal.stop).toHaveBeenCalledOnce();
});

it("ignores failed or unrelated item loads", () => {
	const events = createTestEventBus();
	const journal = {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
		refreshEntry: vi.fn(),
		stop: vi.fn(),
		refreshItem: vi.fn((id: number) => id === 42),
	};
	const view = {
		invalidate: vi.fn(),
		refreshCooldowns: vi.fn(),
		resume: vi.fn(),
	};
	const module = new ToysModule(
		{ openPanel: vi.fn(), closePanel: vi.fn() },
		events,
		view,
		{ disable: vi.fn(), restore: vi.fn(), isOpen: () => false },
		journal,
	);
	module.initialize();
	events.emit("ITEM_DATA_LOAD_RESULT", { id: 12, success: true });
	events.emit("ITEM_DATA_LOAD_RESULT", { id: 42, success: false });
	expect(view.invalidate).not.toHaveBeenCalled();
	events.emit("ITEM_DATA_LOAD_RESULT", { id: 42, success: true });
	expect(view.invalidate).not.toHaveBeenCalled();
});
