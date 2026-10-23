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

it("creates a horizontal slider with Blizzard's minimal slider skin", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	new WowFrameFactory().createFrame("Slider");
	expect(create).toHaveBeenCalledWith(
		"Slider",
		undefined,
		UIParent,
		"MinimalSliderTemplate",
	);
});

it("creates Blizzard's native search box including its icon and clear button", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	new WowFrameFactory().createFrame("SearchBox");
	expect(create).toHaveBeenCalledExactlyOnceWith(
		"EditBox",
		undefined,
		UIParent,
		"SearchBoxTemplate",
	);
});

it("creates the standard Blizzard filter dropdown intrinsic and skin", () => {
	vi.stubGlobal("UIParent", {});
	const create = vi.fn();
	vi.stubGlobal("CreateFrame", create);
	new WowFrameFactory().createFrame("FilterDropdown");
	expect(create).toHaveBeenCalledExactlyOnceWith(
		"DropdownButton",
		undefined,
		UIParent,
		"WowStyle1FilterDropdownTemplate",
	);
});

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
