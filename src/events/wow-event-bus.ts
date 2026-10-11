import type { WowEventFrame } from "../types";
import { EventBus } from "./event-bus";
export interface EventFrameFactory {
	createEventFrame(): WowEventFrame;
}
/** Owns the hidden event frame; modules only see IEventBus. */
export class WowEventBus extends EventBus {
	private readonly frame: WowEventFrame;
	constructor(factory: EventFrameFactory) {
		super();
		this.frame = factory.createEventFrame();
		this.frame.Hide();
		this.frame.RegisterEvent("PLAYER_LOGIN");
		this.frame.RegisterEvent("BAG_UPDATE_DELAYED");
		this.frame.RegisterEvent("BAG_OPEN");
		this.frame.RegisterEvent("BAG_CLOSED");
		this.frame.SetScript("OnEvent", (_frame, event) => {
			if (
				event === "PLAYER_LOGIN" ||
				event === "BAG_UPDATE_DELAYED" ||
				event === "BAG_OPEN" ||
				event === "BAG_CLOSED"
			)
				this.emit(event);
		});
	}
}
