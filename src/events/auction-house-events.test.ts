import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("registers auction events and translates result identities and commodity quote prices", () => {
	let dispatch: (
		frame: WowEventFrame,
		event: string,
		...args: unknown[]
	) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_name: string, callback: typeof dispatch) => {
			dispatch = callback;
		},
	} as unknown as WowEventFrame;
	const events = new WowEventBus({ createEventFrame: () => frame });
	const changed = vi.fn();
	const show = vi.fn();
	events.subscribe("AUCTION_HOUSE_CHANGED", changed);
	events.subscribe("AUCTION_HOUSE_SHOW", show);
	expect(frame.RegisterEvent).toHaveBeenCalledWith("COMMODITY_PRICE_UPDATED");
	dispatch(frame, "AUCTION_HOUSE_SHOW");
	expect(show).toHaveBeenCalledOnce();
	dispatch(frame, "COMMODITY_PRICE_UPDATED", 100, 1000);
	expect(changed).toHaveBeenLastCalledWith({
		kind: "COMMODITY_PRICE_UPDATED",
		unitPrice: 100,
		totalPrice: 1000,
	});
	dispatch(frame, "ITEM_SEARCH_RESULTS_UPDATED", { itemID: 123 });
	expect(changed).toHaveBeenLastCalledWith({
		kind: "ITEM_SEARCH_RESULTS_UPDATED",
		itemID: 123,
	});
});
