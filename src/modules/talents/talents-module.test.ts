import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { TalentsModule } from "./talents-module";

it("opens on the left, refreshes through injected events and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => false),
		isFullOpen: vi.fn(() => false),
	};
	const module = new TalentsModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	native.isOpen.mockReturnValue(true);
	events.emit("TALENTS_VISIBILITY_CHANGED");
	events.emit("TALENTS_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("talents", "left");
	events.emit("TALENTS_CHANGED");
	events.emit("COMBAT_ENDED");
	expect(view.refresh).toHaveBeenCalledTimes(2);
	native.isOpen.mockReturnValue(false);
	events.emit("TALENTS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("left", "talents");
	module.shutdown();
	events.emit("TALENTS_CHANGED");
	expect(view.refresh).toHaveBeenCalledTimes(2);
	expect(native.restore).toHaveBeenCalledOnce();
});

it("hosts the full native editor in the fullscreen panel and refreshes it through application events", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn() };
	const tree = { refresh: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: () => false,
		isFullOpen: vi.fn(() => false),
	};
	const module = new TalentsModule(ui, events, view, native, tree);
	module.initialize();
	native.isFullOpen.mockReturnValue(true);
	events.emit("TALENTS_VISIBILITY_CHANGED");
	events.emit("TALENTS_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith(
		"talent-tree",
		"fullscreen",
	);
	events.emit("TALENTS_CHANGED");
	expect(tree.refresh).toHaveBeenCalledOnce();
	native.isFullOpen.mockReturnValue(false);
	events.emit("TALENTS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith(
		"fullscreen",
		"talent-tree",
	);
	module.shutdown();
	events.emit("TALENTS_CHANGED");
	expect(tree.refresh).toHaveBeenCalledOnce();
});
