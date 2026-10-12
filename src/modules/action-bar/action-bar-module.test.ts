import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { ActionBarModule } from "./action-bar-module";

it("starts the cross bar, refreshes action changes and restores native UI on shutdown", () => {
	const events = createTestEventBus();
	const client = {
		canModify: () => true,
		syncBuiltInVisibility: vi.fn(),
		disableBuiltIn: vi.fn(),
		restore: vi.fn(),
	};
	const view = { initialize: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
	const module = new ActionBarModule(events, client, view);
	module.disableBuiltIn();
	module.initialize();
	expect(client.disableBuiltIn).toHaveBeenCalled();
	expect(view.initialize).toHaveBeenCalledOnce();
	expect(client.syncBuiltInVisibility).toHaveBeenCalledOnce();
	events.emit("ACTION_BAR_CURSOR_CHANGED");
	expect(client.syncBuiltInVisibility).toHaveBeenCalledTimes(2);
	events.emit("ACTION_BAR_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("ACTION_BAR_CURSOR_CHANGED");
	expect(client.syncBuiltInVisibility).toHaveBeenCalledTimes(2);
	events.emit("ACTION_BAR_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	expect(view.destroy).toHaveBeenCalledOnce();
	expect(client.restore).toHaveBeenCalledOnce();
});

it("defers startup and shutdown until combat ends", () => {
	const events = createTestEventBus();
	let combat = true;
	const client = {
		canModify: () => !combat,
		syncBuiltInVisibility: vi.fn(),
		disableBuiltIn: vi.fn(),
		restore: vi.fn(),
	};
	const view = { initialize: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
	const module = new ActionBarModule(events, client, view);
	module.disableBuiltIn();
	module.initialize();
	expect(client.disableBuiltIn).not.toHaveBeenCalled();
	expect(view.initialize).not.toHaveBeenCalled();
	combat = false;
	events.emit("COMBAT_ENDED");
	expect(view.initialize).toHaveBeenCalledOnce();
	combat = true;
	module.shutdown();
	expect(view.destroy).not.toHaveBeenCalled();
	combat = false;
	events.emit("COMBAT_ENDED");
	expect(client.restore).toHaveBeenCalledOnce();
	expect(view.destroy).toHaveBeenCalledOnce();
	events.emit("COMBAT_ENDED");
	expect(client.restore).toHaveBeenCalledOnce();
});
