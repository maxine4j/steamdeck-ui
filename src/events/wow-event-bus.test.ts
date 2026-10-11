import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("forwards native login events through the hidden event frame", () => {
	let dispatch: (frame: WowEventFrame, event: string) => void = () => {};
	const frame: WowEventFrame = {
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		CreateTexture: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: vi.fn((_script, handler) => {
			dispatch = handler;
		}),
	};
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const login = vi.fn();
	bus.subscribe("PLAYER_LOGIN", login);
	expect(frame.Hide).toHaveBeenCalledOnce();
	expect(frame.RegisterEvent).toHaveBeenCalledWith("PLAYER_LOGIN");
	dispatch(frame, "OTHER_EVENT");
	expect(login).not.toHaveBeenCalled();
	dispatch(frame, "PLAYER_LOGIN");
	expect(login).toHaveBeenCalledOnce();
	const bagUpdate = vi.fn();
	bus.subscribe("BAG_UPDATE_DELAYED", bagUpdate);
	expect(frame.RegisterEvent).toHaveBeenCalledWith("BAG_UPDATE_DELAYED");
	dispatch(frame, "BAG_UPDATE_DELAYED");
	expect(bagUpdate).toHaveBeenCalledOnce();
	const opened = vi.fn();
	const closed = vi.fn();
	bus.subscribe("BAG_OPEN", opened);
	bus.subscribe("BAG_CLOSED", closed);
	expect(frame.RegisterEvent).toHaveBeenCalledWith("BAG_OPEN");
	expect(frame.RegisterEvent).toHaveBeenCalledWith("BAG_CLOSED");
	dispatch(frame, "BAG_OPEN");
	dispatch(frame, "BAG_CLOSED");
	expect(opened).toHaveBeenCalledOnce();
	expect(closed).toHaveBeenCalledOnce();
	for (const event of ["PLAYER_MONEY", "ITEM_DATA_LOAD_RESULT"] as const) {
		const handler = vi.fn();
		bus.subscribe(event, handler);
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
		expect(handler).toHaveBeenCalledOnce();
	}
});
