import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import {
	ControllerInputClient,
	type IGamePadInput,
} from "./controller-input-client";

afterEach(() => vi.unstubAllGlobals());

it("captures navigation only while active, propagates other buttons and restores input after combat", () => {
	let combat = false;
	let modifier = false;
	vi.stubGlobal("InCombatLockdown", () => combat);
	vi.stubGlobal("IsModifierKeyDown", () => modifier);
	const events = createTestEventBus();
	const down = vi.fn();
	const interact = vi.fn();
	events.subscribe("NAV_DOWN", down);
	events.subscribe("NAV_INTERACT", interact);
	let handler: ((button: string) => boolean) | undefined;
	const surface: IGamePadInput = {
		setGamePadInput: vi.fn((callback) => {
			handler = callback;
		}),
		destroy: vi.fn(),
	};
	const client = new ControllerInputClient(events, surface);
	client.setActive(true);
	expect(handler?.("PADDDOWN")).toBe(true);
	expect(down).toHaveBeenCalledOnce();
	expect(handler?.("PAD1")).toBe(true);
	expect(interact).toHaveBeenCalledOnce();
	expect(handler?.("PAD2")).toBe(false);
	modifier = true;
	expect(handler?.("PADDDOWN")).toBe(false);
	modifier = false;
	combat = true;
	events.emit("COMBAT_STARTED");
	expect(handler).toBeUndefined();
	combat = false;
	events.emit("COMBAT_ENDED");
	expect(handler?.("PADDDOWN")).toBe(true);
	client.setActive(false);
	expect(handler).toBeUndefined();
	client.shutdown();
	events.emit("COMBAT_ENDED");
	expect(surface.destroy).toHaveBeenCalledOnce();
	expect(handler).toBeUndefined();
});
