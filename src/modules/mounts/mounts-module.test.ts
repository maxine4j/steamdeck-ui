import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { MountsModule } from "./mounts-module";

it("opens and closes mounts on the right, refreshes journal events and restores the native pane", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = {
		invalidate: vi.fn(),
		onJournalSearchUpdated: vi.fn(),
		refreshEquipment: vi.fn(),
	};
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isOpen: vi.fn(() => true),
	};
	const module = new MountsModule(ui, events, view, native, {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
		stop: vi.fn(),
	});
	module.disableBuiltIn();
	module.initialize();
	events.emit("MOUNTS_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("mounts", "right");
	native.isOpen.mockReturnValue(false);
	events.emit("MOUNTS_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("right", "mounts");
	events.emit("MOUNTS_CHANGED");
	expect(view.invalidate).toHaveBeenCalledOnce();
	events.emit("MOUNTS_SEARCH_CHANGED");
	expect(view.onJournalSearchUpdated).toHaveBeenCalledOnce();
	events.emit("MOUNTS_EQUIPMENT_CHANGED");
	expect(view.refreshEquipment).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("MOUNTS_CHANGED");
	expect(view.invalidate).toHaveBeenCalledOnce();
	events.emit("MOUNTS_SEARCH_CHANGED");
	expect(view.onJournalSearchUpdated).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});

it("prefetches at initialization, invalidates journal data and stops on shutdown", () => {
	const events = createTestEventBus();
	const journal = { prefetch: vi.fn(), invalidate: vi.fn(), stop: vi.fn() };
	const module = new MountsModule(
		{ openPanel: vi.fn(), closePanel: vi.fn() },
		events,
		{
			invalidate: vi.fn(),
			onJournalSearchUpdated: vi.fn(),
			refreshEquipment: vi.fn(),
		},
		{ disable: vi.fn(), restore: vi.fn(), isOpen: () => false },
		journal,
	);
	module.initialize();
	expect(journal.prefetch).toHaveBeenCalledOnce();
	events.emit("MOUNTS_CHANGED");
	events.emit("MOUNTS_SEARCH_CHANGED");
	expect(journal.invalidate).toHaveBeenCalledTimes(2);
	module.shutdown();
	expect(journal.stop).toHaveBeenCalledOnce();
});
