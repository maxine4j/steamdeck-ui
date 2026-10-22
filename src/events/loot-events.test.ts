import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("publishes loot lifecycle and changed slots through the injected event bus", () => {
	let dispatch: (frame: WowEventFrame, event: string) => void = () => {};
	const native = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, callback: typeof dispatch) => {
			dispatch = callback;
		},
	};
	const frame = native as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const changed = vi.fn();
	bus.subscribe("LOOT_UPDATED", changed);
	for (const event of [
		"LOOT_OPENED",
		"LOOT_CLOSED",
		"LOOT_SLOT_CHANGED",
		"LOOT_SLOT_CLEARED",
	]) {
		expect(native.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(changed).toHaveBeenCalledTimes(4);
});
