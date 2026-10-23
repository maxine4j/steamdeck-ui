import type { WowEventFrame, WowFrame } from "../types";
import type { FrameFactory, FrameType } from "./frame-pool-manager";
export class WowFrameFactory implements FrameFactory {
	private nextSecureId = 0;
	private nextTooltipId = 0;
	createFrame(type: FrameType): WowFrame {
		if (type === "Slider")
			return CreateFrame(
				"Slider",
				undefined,
				UIParent,
				"MinimalSliderTemplate",
			);
		if (type === "SearchBox")
			return CreateFrame("EditBox", undefined, UIParent, "SearchBoxTemplate");
		if (type === "FilterDropdown")
			return CreateFrame(
				"DropdownButton",
				undefined,
				UIParent,
				"WowStyle1FilterDropdownTemplate",
			);
		if (type === "FocusTimer") return CreateFrame("Frame");
		if (type === "SecureFrame")
			return CreateFrame(
				"Frame",
				undefined,
				UIParent,
				"SecureHandlerBaseTemplate,SecureHandlerStateTemplate",
			);
		if (type === "GameTooltip" || type === "ShoppingTooltip")
			return CreateFrame(
				"GameTooltip",
				`SteamDeckUIItemTooltip${++this.nextTooltipId}`,
				UIParent,
				type === "ShoppingTooltip"
					? "ShoppingTooltipTemplate"
					: "GameTooltipTemplate",
			);
		if (type === "SecureStateButton")
			return CreateFrame(
				"Button",
				`SteamDeckUISecureButton${++this.nextSecureId}`,
				UIParent,
				"SecureActionButtonTemplate,SecureHandlerStateTemplate,SecureHandlerDragTemplate",
			);
		if (type === "SecureRingButton")
			return CreateFrame(
				"Button",
				`SteamDeckUISecureRing${++this.nextSecureId}`,
				UIParent,
				"SecureActionButtonTemplate,SecureHandlerBaseTemplate",
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
				`SteamDeckUISecureButton${++this.nextSecureId}`,
				UIParent,
				"SecureActionButtonTemplate",
			);
		return CreateFrame(type, undefined, UIParent);
	}
	createEventFrame(): WowEventFrame {
		return CreateFrame("Frame");
	}
}
