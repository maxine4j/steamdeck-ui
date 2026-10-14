import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("routes mailbox lifecycle and operation events through the injected bus", () => {
	let dispatch: (frame: WowEventFrame, event: string) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	for (const event of [
		"MAIL_SHOW",
		"MAIL_CLOSED",
		"MAIL_INBOX_UPDATE",
		"MAIL_SEND_INFO_UPDATE",
		"MAIL_SEND_SUCCESS",
		"MAIL_FAILED",
		"MAIL_SUCCESS",
		"MAIL_LOCK_SEND_ITEMS",
		"MAIL_UNLOCK_SEND_ITEMS",
		"CLOSE_INBOX_ITEM",
	] as const) {
		const handler = vi.fn();
		bus.subscribe(event, handler);
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
		expect(handler).toHaveBeenCalledOnce();
	}
});
