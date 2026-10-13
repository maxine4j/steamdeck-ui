import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { DungeonFinderModule } from "./dungeon-finder-module";

it("routes finder visibility to the left dock and unsubscribes on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn() };
	let open = false;
	const native = { disable: vi.fn(), restore: vi.fn(), isOpen: () => open };
	const module = new DungeonFinderModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	open = true;
	events.emit("DUNGEON_FINDER_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("dungeon-finder", "left");
	events.emit("DUNGEON_FINDER_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	open = false;
	events.emit("DUNGEON_FINDER_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("left", "dungeon-finder");
	module.shutdown();
	events.emit("DUNGEON_FINDER_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});
