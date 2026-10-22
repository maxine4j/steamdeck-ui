import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("routes gliding transitions and world lifecycle through the injected event bus", () => {
	let dispatch: (frame: WowEventFrame, event: string) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const changed = vi.fn();
	const suspended = vi.fn();
	bus.subscribe("SKYRIDING_STATE_CHANGED", changed);
	bus.subscribe("SKYRIDING_SUSPENDED", suspended);
	for (const event of [
		"PLAYER_IS_GLIDING_CHANGED",
		"PLAYER_CAN_GLIDE_CHANGED",
		"PLAYER_ENTERING_WORLD",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(changed).toHaveBeenCalledTimes(3);
	for (const event of ["PLAYER_LEAVING_WORLD", "PLAYER_LOGOUT"]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(suspended).toHaveBeenCalledTimes(2);
});
