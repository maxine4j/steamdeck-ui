import { afterEach, expect, it, vi } from "vitest";
import { WowFrameFactory } from "./wow-frame-factory";

afterEach(() => vi.unstubAllGlobals());

it("creates secure slot buttons with native action, paging, and drag handlers", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	new WowFrameFactory().createFrame("SecureStateButton");
	expect(create).toHaveBeenCalledExactlyOnceWith(
		"Button",
		"SteamDeckUISecureButton1",
		UIParent,
		"SecureActionButtonTemplate,SecureHandlerStateTemplate,SecureHandlerDragTemplate",
	);
});

it("creates explicitly protected containers for restricted frame anchoring", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	new WowFrameFactory().createFrame("SecureFrame");
	expect(create).toHaveBeenCalledExactlyOnceWith(
		"Frame",
		undefined,
		UIParent,
		"SecureHandlerBaseTemplate",
	);
});
