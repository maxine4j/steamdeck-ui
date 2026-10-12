import { expect, it, vi } from "vitest";
import type { IVendorClient } from "../../clients/vendor-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { VendorModule } from "./vendor-module";

it("opens bags before focusing the dedicated vendor container and coalesces updates", () => {
	const events = createTestEventBus();
	const pending: (() => void)[] = [];
	const cancel = vi.fn();
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return cancel;
		},
	};
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const client = {
		setOpen: vi.fn(),
		ensureBagsOpen: vi.fn(),
		close: vi.fn(),
	} as unknown as IVendorClient;
	const view = { refresh: vi.fn() };
	const native = { disable: vi.fn(), restore: vi.fn() };
	const module = new VendorModule(
		ui,
		events,
		client,
		[view],
		native,
		scheduler,
	);
	const bags = vi.fn(() => ui.openPanel("bags", "right"));
	events.subscribe("BAG_VISIBILITY_CHANGED", bags);
	module.disableBuiltIn();
	module.initialize();
	events.emit("MERCHANT_UPDATE");
	expect(pending).toHaveLength(0);
	events.emit("MERCHANT_SHOW");
	expect(client.ensureBagsOpen).toHaveBeenCalledOnce();
	expect(ui.openPanel.mock.calls).toEqual([
		["bags", "right"],
		["vendor", "left", "merchant"],
	]);
	expect(view.refresh).toHaveBeenCalledOnce();
	events.emit("MERCHANT_UPDATE");
	events.emit("PLAYER_MONEY");
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(view.refresh).toHaveBeenCalledTimes(2);
	events.emit("MERCHANT_CLOSED");
	expect(client.setOpen).toHaveBeenLastCalledWith(false);
	expect(ui.closePanel).toHaveBeenLastCalledWith("left", undefined, "merchant");
	module.shutdown();
	expect(native.restore).toHaveBeenCalledOnce();
	events.emit("MERCHANT_SHOW");
	expect(client.ensureBagsOpen).toHaveBeenCalledOnce();
});

it("closes the native interaction and cancels pending work on shutdown", () => {
	const events = createTestEventBus();
	const cancel = vi.fn();
	const client = {
		setOpen: vi.fn(),
		ensureBagsOpen: vi.fn(),
		close: vi.fn(),
	} as unknown as IVendorClient;
	const module = new VendorModule(
		{ openPanel: vi.fn(), closePanel: vi.fn() },
		events,
		client,
		[],
		{ disable: vi.fn(), restore: vi.fn() },
		{ nextFrame: () => cancel },
	);
	module.initialize();
	events.emit("MERCHANT_SHOW");
	events.emit("MERCHANT_UPDATE");
	module.shutdown();
	expect(cancel).toHaveBeenCalledOnce();
	expect(client.close).toHaveBeenCalledOnce();
});
