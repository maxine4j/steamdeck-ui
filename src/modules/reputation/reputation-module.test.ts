import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { ReputationModule } from "./reputation-module";

it("refreshes through the bus, opens native reputation on the left and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => false),
		isCharacterOpen: vi.fn(() => true),
	};
	const module = new ReputationModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	events.emit("REPUTATION_CHANGED");
	expect(view.refresh).toHaveBeenCalled();
	native.isOpen.mockReturnValue(true);
	events.emit("REPUTATION_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("reputation", "left");
	native.isOpen.mockReturnValue(false);
	events.emit("REPUTATION_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("left", "reputation");
	native.isCharacterOpen.mockReturnValue(false);
	events.emit("REPUTATION_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledOnce();
	module.shutdown();
	const count = view.refresh.mock.calls.length;
	events.emit("REPUTATION_CHANGED");
	expect(view.refresh).toHaveBeenCalledTimes(count);
	expect(native.restore).toHaveBeenCalledOnce();
});
