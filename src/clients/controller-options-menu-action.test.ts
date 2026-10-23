import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { SystemDialogsModule } from "../modules/system-dialogs/system-dialogs-module";
import { NavigationManager } from "../ui/navigation/navigation-manager";
import { ControllerOptionsMenuAction } from "./controller-options-menu-action";

afterEach(() => vi.unstubAllGlobals());

it("closes Escape and its portrait menu before requesting the fullscreen options window", () => {
	const events = createTestEventBus();
	const sequence: string[] = [];
	const menu = {};
	vi.stubGlobal("_G", { GameMenuFrame: menu });
	vi.stubGlobal("HideUIPanel", (frame: unknown) => {
		expect(frame).toBe(menu);
		sequence.push("hidden");
	});
	events.subscribe("CONTROLLER_OPTIONS_OPEN_REQUESTED", () =>
		sequence.push("options"),
	);
	new ControllerOptionsMenuAction(events).activate();
	expect(sequence).toEqual(["hidden", "options"]);
});

it("releases Escape navigation before activating the options grid", () => {
	const events = createTestEventBus();
	const navigation = new NavigationManager(events);
	const node = (navId: string) => ({
		navId,
		onFocus: vi.fn(),
		onBlur: vi.fn(),
		onInteract: vi.fn(),
	});
	const first = node("option-first");
	const previous = node("option-first-previous");
	const next = node("option-next");
	let visible = true;
	const menu = {};
	vi.stubGlobal("_G", { GameMenuFrame: menu });
	vi.stubGlobal("HideUIPanel", () => {
		visible = false;
	});
	const dialogs = new SystemDialogsModule(
		{
			initialize: vi.fn(),
			shutdown: vi.fn(),
			getDialogs: () =>
				visible
					? [{ id: "escape", grid: [[node("menu-options")]], cancel: vi.fn() }]
					: [],
		},
		events,
		navigation,
	);
	dialogs.initialize();
	events.subscribe("CONTROLLER_OPTIONS_OPEN_REQUESTED", () => {
		navigation.registerGrid("options", [[first, previous], [next]]);
		navigation.setActiveGrid("options");
	});
	new ControllerOptionsMenuAction(events).activate();
	// Native visibility notifications normally arrive on the following frame.
	events.emit("NATIVE_DIALOGS_CHANGED");
	expect(navigation.focusedId).toBe(first.navId);
	events.emit("NAV_RIGHT");
	events.emit("NAV_INTERACT");
	expect(previous.onInteract).toHaveBeenCalledOnce();
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(next.onInteract).toHaveBeenCalledOnce();
	dialogs.shutdown();
	navigation.destroy();
});
