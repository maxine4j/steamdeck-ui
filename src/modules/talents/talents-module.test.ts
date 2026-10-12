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
