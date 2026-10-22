import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { TradingPostModule } from "./trading-post-module";

it("opens Trading Post once per native visibility transition, refreshes its grid and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const client = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => false),
	};
	const panel = { refresh: vi.fn() };
	const module = new TradingPostModule(ui, events, client, panel);
	module.disableBuiltIn();
	module.initialize();
	expect(client.disable).toHaveBeenCalledOnce();
	client.isOpen.mockReturnValue(true);
	events.emit("TRADING_POST_VISIBILITY_CHANGED");
	events.emit("TRADING_POST_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith(
		"trading-post",
		"fullscreen",
	);
	events.emit("TRADING_POST_CHANGED");
	expect(panel.refresh).toHaveBeenCalledOnce();
	client.isOpen.mockReturnValue(false);
	events.emit("TRADING_POST_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith(
		"fullscreen",
		"trading-post",
	);
	module.shutdown();
	events.emit("TRADING_POST_CHANGED");
	expect(panel.refresh).toHaveBeenCalledOnce();
	expect(client.restore).toHaveBeenCalledOnce();
});
