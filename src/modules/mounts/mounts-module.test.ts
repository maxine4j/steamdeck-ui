import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { MountsModule } from "./mounts-module";

it("opens mounts on the left, refreshes journal events and restores the native pane", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn() };
	const native = { disable: vi.fn(), restore: vi.fn(), isOpen: () => true };
	const module = new MountsModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	events.emit("MOUNTS_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("mounts", "left");
	events.emit("MOUNTS_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("MOUNTS_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});
