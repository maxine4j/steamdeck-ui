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
		this.frame.SetScript("OnEvent", (_frame, event) => {
			if (event === "PLAYER_LOGIN") this.emit(event);
		});
	}
}
