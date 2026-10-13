import { afterEach, expect, it, vi } from "vitest";
import { WowFrameFactory } from "./wow-frame-factory";

it("creates focus animation timers as plain native frames", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	new WowFrameFactory().createFrame("FocusTimer");
	expect(create).toHaveBeenCalledWith("Frame");
});

afterEach(() => vi.unstubAllGlobals());

it("gives pooled secure action buttons unique names for hardware click bindings", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	const factory = new WowFrameFactory();
	factory.createFrame("SecureButton");
	factory.createFrame("SecureButton");
	expect(create.mock.calls.map((call) => call.at(1))).toEqual([
		"SteamDeckUISecureButton1",
		"SteamDeckUISecureButton2",
	]);
});

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
		"SecureHandlerBaseTemplate,SecureHandlerStateTemplate",
	);
});
