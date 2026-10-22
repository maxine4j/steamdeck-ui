import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { HeirloomsModule } from "./heirlooms-module";

it("warms, routes collection updates and visibility to the right panel, and restores on shutdown", () => {
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const events = createTestEventBus();
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => true),
	};
	const client = { prefetch: vi.fn(), refreshEntry: vi.fn(), stop: vi.fn() };
	const view = { resume: vi.fn() };
	const module = new HeirloomsModule(ui, events, native, client, view);
	module.disableBuiltIn();
	module.initialize();
	expect(native.disable).toHaveBeenCalledOnce();
	expect(client.prefetch).toHaveBeenCalledOnce();
	expect(ui.openPanel).toHaveBeenCalledWith("heirlooms", "right");
	events.emit("HEIRLOOMS_CHANGED", { id: 12 });
	expect(client.refreshEntry).toHaveBeenCalledWith(12);
	events.emit("COMBAT_ENDED");
	expect(view.resume).toHaveBeenCalledOnce();
	native.isOpen.mockReturnValue(false);
	events.emit("HEIRLOOMS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("right", "heirlooms");
	module.shutdown();
	client.refreshEntry.mockClear();
	events.emit("HEIRLOOMS_CHANGED");
	expect(client.refreshEntry).not.toHaveBeenCalled();
	expect(client.stop).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});
