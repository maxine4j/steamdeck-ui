import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { ControllerInputClient } from "./controller-input-client";
import { ControllerOptionsClient } from "./controller-options-client";
import { TaskScheduler } from "./task-scheduler";

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal("SteamDeckUIConfig", undefined);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("IsModifierKeyDown", () => false);
	vi.stubGlobal("hooksecurefunc", vi.fn());
	vi.stubGlobal("IsGamePadCursorControlEnabled", () => false);
	vi.stubGlobal("SetGamePadCursorControl", vi.fn());
	vi.stubGlobal("C_CVar", { GetCVar: () => "original", SetCVar: vi.fn() });
	vi.stubGlobal("C_Timer", {
		After: (seconds: number, callback: () => void) =>
			setTimeout(callback, seconds * 1000),
	});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function setup() {
	const events = createTestEventBus();
	const next = vi.fn();
	const toggle = vi.fn();
	const cancel = vi.fn();
	events.subscribe("OBJECTIVE_NEXT_REQUESTED", next);
	events.subscribe("OBJECTIVE_TRACKER_TOGGLE_REQUESTED", toggle);
	events.subscribe("NAV_CANCEL", cancel);
	let down: ((button: string) => boolean) | undefined;
	let up: ((button: string) => void) | undefined;
	const client = new ControllerInputClient(
		events,
		{
			setClickBindings: vi.fn(),
			setGamePadInput: (d, u) => {
				down = d;
				up = u;
			},
			destroy: vi.fn(),
		},
		new ControllerOptionsClient(events),
		new TaskScheduler(),
	);
	client.initialize();
	return {
		events,
		client,
		next,
		toggle,
		cancel,
		down: (key = "PADBACK") => down?.(key),
		up: (key = "PADBACK") => up?.(key),
	};
}

it("cycles once on a short Back release in world gameplay and leaves B for panel cancel", () => {
	const input = setup();
	expect(input.down()).toBe(true);
	input.down();
	expect(input.next).not.toHaveBeenCalled();
	vi.advanceTimersByTime(2999);
	input.up();
	input.up();
	vi.advanceTimersByTime(3000);
	expect(input.next).toHaveBeenCalledOnce();
	expect(input.toggle).not.toHaveBeenCalled();
	expect(input.down("PAD2")).toBe(false);
	for (const key of ["PADDUP", "PAD1", "PAD3", "PAD4", "PADSTART"])
		expect(input.down(key)).toBe(false);
	input.client.setActive(true);
	expect(input.down("PAD2")).toBe(true);
	expect(input.cancel).toHaveBeenCalledOnce();
	input.client.setActive(false);
	expect(input.down()).toBe(true);
	input.up();
	expect(input.next).toHaveBeenCalledTimes(2);
});

it("toggles once at three seconds and suppresses cycling on long-hold release", () => {
	const input = setup();
	input.down();
	vi.advanceTimersByTime(2999);
	expect(input.toggle).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(input.toggle).toHaveBeenCalledOnce();
	input.down();
	vi.advanceTimersByTime(9000);
	input.up();
	expect(input.toggle).toHaveBeenCalledOnce();
	expect(input.next).not.toHaveBeenCalled();
	input.down();
	input.up();
	expect(input.next).toHaveBeenCalledOnce();
});

it("cancels pending holds for binding capture, combat, and shutdown", () => {
	const input = setup();
	expect(input.down()).toBe(true);
	input.client.setActive(true);
	const capture = vi.fn();
	input.client.setBindingCapture(capture);
	vi.advanceTimersByTime(3000);
	input.up();
	input.down();
	input.up();
	expect(capture).toHaveBeenCalledExactlyOnceWith("PADBACK");
	input.client.setBindingCapture();
	expect(input.down()).toBe(true);
	vi.stubGlobal("InCombatLockdown", () => true);
	input.events.emit("COMBAT_STARTED");
	vi.advanceTimersByTime(3000);
	input.up();
	vi.stubGlobal("InCombatLockdown", () => false);
	input.events.emit("COMBAT_ENDED");
	input.up();
	expect(input.down()).toBe(true);
	input.client.shutdown();
	vi.advanceTimersByTime(3000);
	input.up();
	expect(input.down()).toBeUndefined();
	expect(input.next).not.toHaveBeenCalled();
	expect(input.toggle).not.toHaveBeenCalled();
});
