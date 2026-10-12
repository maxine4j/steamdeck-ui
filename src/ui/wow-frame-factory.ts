import type { WowEventFrame, WowFrame } from "../types";
import type { FrameFactory, FrameType } from "./frame-pool-manager";
export class WowFrameFactory implements FrameFactory {
	private nextSecureId = 0;
	createFrame(type: FrameType): WowFrame {
		if (type === "SecureStateButton")
			return CreateFrame(
				"Button",
				`SteamDeckUISecureButton${++this.nextSecureId}`,
				UIParent,
				"SecureActionButtonTemplate,SecureHandlerStateTemplate",
			);
		if (type === "Cooldown")
			return CreateFrame(
				"Cooldown",
				undefined,
				UIParent,
				"CooldownFrameTemplate",
			);
		if (type === "SecureButton")
			return CreateFrame(
				"Button",
				undefined,
				UIParent,
				"SecureActionButtonTemplate",
			);
		return CreateFrame(type, undefined, UIParent);
	}
	createEventFrame(): WowEventFrame {
		return CreateFrame("Frame");
	}
}
