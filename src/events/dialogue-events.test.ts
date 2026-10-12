import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("preserves transient dialogue payloads and continuing close events", () => {
	let dispatch: (
		frame: WowEventFrame,
		event: string,
		...args: unknown[]
	) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_name: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const confirm = vi.fn(),
		close = vi.fn(),
		detail = vi.fn(),
		shared = vi.fn();
	bus.subscribe("GOSSIP_CONFIRM", confirm);
	bus.subscribe("GOSSIP_CLOSED", close);
	bus.subscribe("QUEST_DETAIL", detail);
	bus.subscribe("QUEST_ACCEPT_CONFIRM", shared);
	dispatch(frame, "GOSSIP_CONFIRM", 801, "Pay?", 5000);
	dispatch(frame, "GOSSIP_CLOSED", true);
	dispatch(frame, "QUEST_DETAIL", 321);
	dispatch(frame, "QUEST_ACCEPT_CONFIRM", "Friend", "Title", 91);
	expect(confirm).toHaveBeenCalledWith({
		optionID: 801,
		text: "Pay?",
		cost: 5000,
	});
	expect(close).toHaveBeenCalledWith({ continuing: true });
	expect(detail).toHaveBeenCalledWith({ startItem: 321 });
	expect(shared).toHaveBeenCalledWith({
		speaker: "Friend",
		title: "Title",
		questID: 91,
	});
	bus.unsubscribe("GOSSIP_CONFIRM", confirm);
	dispatch(frame, "GOSSIP_CONFIRM", 1, "Late", 0);
	expect(confirm).toHaveBeenCalledOnce();
});
