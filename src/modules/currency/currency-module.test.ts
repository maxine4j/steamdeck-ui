import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { CurrencyModule } from "./currency-module";

it("routes visibility and data through the bus and restores native UI on shutdown", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = {
		refresh: vi.fn(),
		closeOptions: vi.fn(),
		transferResult: vi.fn(),
	};
	let open = false;
	const native = { disable: vi.fn(), restore: vi.fn(), isOpen: () => open };
	const module = new CurrencyModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	events.emit("CURRENCY_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	events.emit("CURRENCY_TRANSFER_REJECTED");
	expect(view.transferResult).toHaveBeenCalledWith(false);
	open = true;
	events.emit("CURRENCY_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("currency", "right");
	open = false;
	events.emit("CURRENCY_VISIBILITY_CHANGED");
	expect(ui.closePanel).toHaveBeenCalledWith("right", "currency");
	module.shutdown();
	events.emit("CURRENCY_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});
