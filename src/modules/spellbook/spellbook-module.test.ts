import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { SpellbookModule } from "./spellbook-module";

it("owns the spellbook lifecycle, opens on the left and refreshes through injected events", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		isSpellbookOpen: vi.fn(() => false),
	};
	const module = new SpellbookModule(ui, events, view, native);
	module.disableBuiltIn();
	expect(native.disable).toHaveBeenCalledOnce();
	module.initialize();
	native.isSpellbookOpen.mockReturnValue(true);
	events.emit("SPELLBOOK_VISIBILITY_CHANGED");
	events.emit("SPELLBOOK_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("spellbook", "left");
	events.emit("SPELLBOOK_CHANGED");
	events.emit("COMBAT_ENDED");
	expect(view.refresh).toHaveBeenCalledTimes(2);
	native.isSpellbookOpen.mockReturnValue(false);
	events.emit("SPELLBOOK_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledExactlyOnceWith("left", "spellbook");
	module.shutdown();
	events.emit("SPELLBOOK_CHANGED");
	expect(view.refresh).toHaveBeenCalledTimes(2);
	expect(native.restore).toHaveBeenCalledOnce();
});
