import { expect, it, vi } from "vitest";
import { Diagnostics } from "../../clients/diagnostics";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IPanel } from "../../ui/panel/types";
import { DebugModule } from "./debug-module";

it("opens the errors tab in its own left container on request and detaches on shutdown", () => {
	const events = createTestEventBus();
	const diagnostics = new Diagnostics(() => 100);
	const client = { diagnostics, initialize: vi.fn(), shutdown: vi.fn() };
	const ui = {
		registerPanel: vi.fn(),
		openPanel: vi.fn(),
		closePanel: vi.fn(),
	};
	const logs = { id: "debug-logs" } as IPanel;
	const cache = { id: "debug-cache" } as IPanel;
	const errors = { id: "debug-errors" } as IPanel;
	const module = new DebugModule(ui, events, client, logs, cache, errors);
	module.initialize();
	expect(ui.registerPanel).toHaveBeenCalledWith(logs, "left", "debug");
	expect(ui.registerPanel).toHaveBeenCalledWith(cache, "left", "debug");
	expect(ui.registerPanel).toHaveBeenCalledWith(errors, "left", "debug");
	events.emit("DEBUG_OPEN_REQUESTED");
	expect(ui.openPanel).toHaveBeenCalledWith("debug-errors", "left", "debug");
	module.shutdown();
	ui.openPanel.mockClear();
	events.emit("DEBUG_OPEN_REQUESTED");
	expect(ui.openPanel).not.toHaveBeenCalled();
	expect(client.shutdown).toHaveBeenCalledOnce();
});
