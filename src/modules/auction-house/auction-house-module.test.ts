import { expect, it, vi } from "vitest";
import type { IAuctionHouseClient } from "../../clients/auction-house-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { AuctionHouseModule } from "./auction-house-module";

it("opens buy beside bags, switches to sell for bag selections, and releases the interaction on close", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const client = {
		setOpen: vi.fn(),
		disableBuiltIn: vi.fn(),
		restoreBuiltIn: vi.fn(),
		search: vi.fn(),
		queryOwned: vi.fn(),
		update: vi.fn(),
		close: vi.fn(),
	} as unknown as IAuctionHouseClient;
	const views = [{ refresh: vi.fn(), reset: vi.fn() }];
	const pending: (() => void)[] = [];
	const cancel = vi.fn();
	const module = new AuctionHouseModule(ui, events, client, views, {
		nextFrame: (callback) => {
			pending.push(callback);
			return cancel;
		},
	});
	module.disableBuiltIn();
	module.initialize();
	events.emit("AUCTION_HOUSE_SHOW");
	expect(ui.openPanel.mock.calls).toEqual([
		["bags", "right"],
		["auction-buy", "left", "auction-house"],
	]);
	expect(client.search).toHaveBeenCalledWith("");
	events.emit("AUCTION_SELL_ITEM_SELECTED");
	expect(ui.openPanel).toHaveBeenLastCalledWith(
		"auction-sell",
		"left",
		"auction-house",
	);
	events.emit("AUCTION_HOUSE_CHANGED", {
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 100,
		totalPrice: 1000,
	});
	expect(client.update).toHaveBeenCalledWith({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 100,
		totalPrice: 1000,
	});
	events.emit("PLAYER_MONEY");
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(views.at(0)?.refresh).toHaveBeenCalledTimes(3);
	events.emit("AUCTION_HOUSE_CLOSED");
	expect(client.setOpen).toHaveBeenLastCalledWith(false);
	expect(ui.closePanel).toHaveBeenLastCalledWith(
		"left",
		undefined,
		"auction-house",
	);
	module.shutdown();
	expect(client.restoreBuiltIn).toHaveBeenCalledOnce();
	events.emit("AUCTION_HOUSE_SHOW");
	expect(client.search).toHaveBeenCalledOnce();
});
