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
});
