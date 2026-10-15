import { expect, it, vi } from "vitest";
import { Diagnostics } from "../../clients/diagnostics";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IPanel } from "../../ui/panel/types";
import { DebugModule } from "./debug-module";

it("opens the logs tab in its own left container on request, records collection events and detaches on shutdown", () => {
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
	const module = new DebugModule(ui, events, client, logs, cache);
	module.initialize();
	expect(ui.registerPanel).toHaveBeenCalledWith(logs, "left", "debug");
	expect(ui.registerPanel).toHaveBeenCalledWith(cache, "left", "debug");
	events.emit("DEBUG_OPEN_REQUESTED");
	expect(ui.openPanel).toHaveBeenCalledWith("debug-logs", "left", "debug");
	events.emit("MOUNTS_CHANGED", { id: 7, source: "new-mount" });
	expect(diagnostics.report()).toContain("MOUNTS_CHANGED");
	module.shutdown();
	ui.openPanel.mockClear();
	events.emit("DEBUG_OPEN_REQUESTED");
	expect(ui.openPanel).not.toHaveBeenCalled();
	expect(client.shutdown).toHaveBeenCalledOnce();
});
