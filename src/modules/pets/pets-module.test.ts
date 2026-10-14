import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { PetsModule } from "./pets-module";

it("warms the journal, routes visibility and change events, resumes combat and restores on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => true),
	};
	const client = {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
		refreshEntry: vi.fn(),
		stop: vi.fn(),
	};
	const panel = { invalidate: vi.fn(), resume: vi.fn() };
	const module = new PetsModule(ui, events, panel, native, client);
	module.disableBuiltIn();
	module.initialize();
	expect(native.disable).toHaveBeenCalledOnce();
	expect(client.prefetch).toHaveBeenCalledOnce();
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("pets", "right");
	events.emit("PETS_CHANGED", { id: "Pet-1" });
	expect(client.refreshEntry).toHaveBeenCalledExactlyOnceWith(
		"Pet-1",
		undefined,
	);
	expect(panel.invalidate).not.toHaveBeenCalled();
	native.isOpen.mockReturnValue(false);
	events.emit("PETS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("right", "pets");
	events.emit("COMBAT_ENDED");
	expect(panel.resume).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("PETS_CHANGED");
	expect(panel.invalidate).not.toHaveBeenCalled();
	expect(native.restore).toHaveBeenCalledOnce();
	expect(client.stop).toHaveBeenCalledOnce();
});
