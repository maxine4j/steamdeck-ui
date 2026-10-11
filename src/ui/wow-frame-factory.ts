import type { WowEventFrame, WowFrame } from "../types";
import type { FrameFactory, FrameType } from "./frame-pool-manager";
export class WowFrameFactory implements FrameFactory {
	createFrame(type: FrameType): WowFrame {
		return CreateFrame(type, undefined, UIParent);
	}
	createEventFrame(): WowEventFrame {
		return CreateFrame("Frame");
	}
}
