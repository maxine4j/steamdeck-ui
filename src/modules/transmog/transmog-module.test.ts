import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { TransmogModule } from "./transmog-module";

it("hosts native transmog fullscreen once per visibility transition, refreshes and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const client = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => false),
	};
	const panel = { refresh: vi.fn() };
	const module = new TransmogModule(ui, events, client, panel);
	module.disableBuiltIn();
	module.initialize();
	expect(client.disable).toHaveBeenCalledOnce();
	client.isOpen.mockReturnValue(true);
	events.emit("TRANSMOG_VISIBILITY_CHANGED");
	events.emit("TRANSMOG_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith(
		"transmog",
		"fullscreen",
	);
	events.emit("TRANSMOG_CHANGED");
	expect(panel.refresh).toHaveBeenCalledOnce();
	client.isOpen.mockReturnValue(false);
	events.emit("TRANSMOG_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith(
		"fullscreen",
		"transmog",
	);
	module.shutdown();
	events.emit("TRANSMOG_CHANGED");
	expect(panel.refresh).toHaveBeenCalledOnce();
	expect(client.restore).toHaveBeenCalledOnce();
});
