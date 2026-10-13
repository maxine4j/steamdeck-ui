import { expect, it, vi } from "vitest";
import type { IMapClient } from "../../clients/map-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { MapModule } from "./map-module";

it("opens only the fullscreen map, coalesces quest refreshes, forwards native details and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	let open = false;
	const client = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: () => open,
	} as unknown as IMapClient;
	const view = { refresh: vi.fn(), showDetails: vi.fn() };
	const pending: (() => void)[] = [];
	const module = new MapModule(ui, events, client, view, {
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	module.disableBuiltIn();
	module.initialize();
	expect(client.disable).toHaveBeenCalledOnce();
	events.emit("QUEST_LOG_UPDATE");
	expect(pending).toHaveLength(0);
	open = true;
	events.emit("MAP_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("map", "fullscreen");
	events.emit("QUEST_LOG_UPDATE");
	events.emit("QUEST_LOG_UPDATE");
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(view.refresh).toHaveBeenCalledOnce();
	events.emit("MAP_DETAILS_CHANGED", { id: 12 });
	expect(view.showDetails).toHaveBeenCalledWith(12);
	open = false;
	events.emit("MAP_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("fullscreen", "map");
	module.shutdown();
	expect(client.restore).toHaveBeenCalledOnce();
	ui.openPanel.mockClear();
	view.showDetails.mockClear();
	open = true;
	events.emit("MAP_VISIBILITY_CHANGED");
	events.emit("MAP_DETAILS_CHANGED", { id: 13 });
	expect(ui.openPanel).not.toHaveBeenCalled();
	expect(view.showDetails).not.toHaveBeenCalled();
});
