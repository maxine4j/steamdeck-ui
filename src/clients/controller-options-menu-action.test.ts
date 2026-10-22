import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
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
