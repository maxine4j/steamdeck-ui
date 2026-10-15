import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("translates source IDs and context-free wardrobe events through the injected bus", () => {
	let dispatch: (
		frame: WowEventFrame,
		event: string,
		...args: unknown[]
	) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const changed = vi.fn();
	bus.subscribe("APPEARANCES_CHANGED", changed);
	for (const event of [
		"TRANSMOG_COLLECTION_SOURCE_ADDED",
		"TRANSMOG_COLLECTION_SOURCE_REMOVED",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event, 42);
		expect(changed).toHaveBeenLastCalledWith({ sourceId: 42 });
	}
	for (const event of [
		"TRANSMOG_COLLECTION_UPDATED",
		"TRANSMOG_COLLECTION_ITEM_UPDATE",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
		expect(changed).toHaveBeenLastCalledWith(undefined);
	}
	dispatch(frame, "TRANSMOG_COLLECTION_UPDATED", 1, 2, 3);
	expect(changed).toHaveBeenLastCalledWith({ appearanceId: 3 });
	expect(frame.RegisterEvent).toHaveBeenCalledWith("TRANSMOG_SEARCH_UPDATED");
	changed.mockClear();
	dispatch(frame, "TRANSMOG_SEARCH_UPDATED", 2);
	expect(changed).not.toHaveBeenCalled();
	dispatch(frame, "TRANSMOG_SEARCH_UPDATED", 1);
	expect(changed).toHaveBeenCalledWith(undefined);
});
