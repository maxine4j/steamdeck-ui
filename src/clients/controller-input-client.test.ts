import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { GamePadRepeatOptions } from "../ui/components/gamepad-input";
import {
	ControllerInputClient,
	type IGamePadInput,
} from "./controller-input-client";

afterEach(() => vi.unstubAllGlobals());

it("propagates secure actions to hardware bindings without emitting addon navigation clicks", () => {
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("IsModifierKeyDown", () => false);
	const events = createTestEventBus();
	const alternate = vi.fn();
	events.subscribe("NAV_ALTERNATE", alternate);
	let handle: ((button: string) => boolean) | undefined;
	const surface: IGamePadInput = {
		setClickBindings: vi.fn(),
		setGamePadInput: vi.fn((callback) => {
			handle = callback;
		}),
		destroy: vi.fn(),
	};
	const target = {} as import("../ui/components/frame").Frame;
	const client = new ControllerInputClient(events, surface);
	client.setActive(true);
	client.setSecureActions({ alternate: target });
	expect(surface.setClickBindings).toHaveBeenLastCalledWith([
		{ key: "PAD3", target },
	]);
	expect(handle?.("PAD3")).toBe(false);
	expect(alternate).not.toHaveBeenCalled();
	client.setSecureActions();
	expect(surface.setClickBindings).toHaveBeenLastCalledWith([]);
	expect(handle?.("PAD3")).toBe(true);
	expect(alternate).toHaveBeenCalledOnce();
	client.setSecureActions({ interact: target });
	expect(surface.setClickBindings).toHaveBeenLastCalledWith([
		{ key: "PAD1", target },
	]);
	client.setActive(false);
	expect(surface.setClickBindings).toHaveBeenLastCalledWith([]);
});

it("enables directional movement in and out of combat, reserves camera input and restores settings", () => {
	const set = vi.fn();
	const cursor = vi.fn();
	let cursorChanged: ((enabled: boolean) => void) | undefined;
	vi.stubGlobal(
		"hooksecurefunc",
		(_name: string, callback: (enabled: boolean) => void) => {
			cursorChanged = callback;
		},
	);
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) => `original-${name}`,
		SetCVar: set,
	});
	vi.stubGlobal("IsGamePadCursorControlEnabled", () => true);
	vi.stubGlobal("SetGamePadCursorControl", cursor);
	vi.stubGlobal("InCombatLockdown", () => false);
	const client = new ControllerInputClient(createTestEventBus(), {
		setClickBindings: vi.fn(),
		setGamePadInput: vi.fn(),
		destroy: vi.fn(),
	});
	client.disableBuiltIn();
	client.initialize();
	client.initialize();
	for (const [name, value] of [
		["GamePadEnable", "1"],
		["GamePadAnalogMovement", "1"],
		["GamePadFaceMovementMaxAngle", "0"],
		["GamePadFaceMovementMaxAngleCombat", "0"],
		["GamePadTurnWithCamera", "0"],
		["GamePadTankTurnSpeed", "0"],
		["GamePadStickAxisButtons", "0"],
		["GamePadCameraYawSpeed", "1"],
		["GamePadCameraPitchSpeed", "1"],
		["GamePadCursorAutoEnable", "0"],
		["GamePadCursorOnLogin", "0"],
		["GamePadCursorForTargeting", "0"],
		["GamePadCursorCenteredEmulation", "0"],
		["GamePadCursorLeftClick", "none"],
		["GamePadCursorRightClick", "none"],
		["GamePadEmulateShift", "PADLTRIGGER"],
		["GamePadEmulateCtrl", "PADLSHOULDER"],
		["GamePadEmulateTapWindowMs", "350"],
		["GamePadEmulateAlt", "none"],
	])
		expect(set).toHaveBeenCalledWith(name, value);
	expect(cursor).toHaveBeenCalledWith(false);
	cursor.mockClear();
	cursorChanged?.(false);
	expect(cursor).not.toHaveBeenCalled();
	cursorChanged?.(true);
	expect(cursor).toHaveBeenCalledExactlyOnceWith(false);
	const configured = set.mock.calls.map(([name]) => name as string);
	client.shutdown();
	for (const name of configured)
		expect(set).toHaveBeenCalledWith(name, `original-${name}`);
	expect(cursor).toHaveBeenLastCalledWith(true);
	cursor.mockClear();
	cursorChanged?.(true);
	expect(cursor).not.toHaveBeenCalled();
});

it("captures navigation only while active, propagates other buttons and restores input after combat", () => {
	let combat = false;
	let modifier = false;
	vi.stubGlobal("InCombatLockdown", () => combat);
	vi.stubGlobal("IsModifierKeyDown", () => modifier);
	const events = createTestEventBus();
	const down = vi.fn();
	const interact = vi.fn();
	const up = vi.fn();
	const left = vi.fn();
	const right = vi.fn();
	const context = vi.fn();
	const cancel = vi.fn();
	const alternate = vi.fn();
	events.subscribe("NAV_ALTERNATE", alternate);
	events.subscribe("NAV_CONTEXT", context);
	events.subscribe("NAV_CANCEL", cancel);
	events.subscribe("NAV_UP", up);
	events.subscribe("NAV_LEFT", left);
	events.subscribe("NAV_RIGHT", right);
	events.subscribe("NAV_DOWN", down);
	events.subscribe("NAV_INTERACT", interact);
	let handler: ((button: string) => boolean) | undefined;
	const surface: IGamePadInput = {
		setClickBindings: vi.fn(),
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
	for (const [key, listener] of [
		["PADDUP", up],
		["PADDLEFT", left],
		["PADDRIGHT", right],
	] as const) {
		expect(handler?.(key)).toBe(true);
		expect(listener).toHaveBeenCalledOnce();
	}
	expect(handler?.("PAD4")).toBe(true);
	expect(context).toHaveBeenCalledOnce();
	expect(handler?.("PAD2")).toBe(true);
	expect(cancel).toHaveBeenCalledOnce();
	expect(handler?.("PAD3")).toBe(true);
	expect(alternate).toHaveBeenCalledOnce();
	for (const [key, event] of [
		["PADLTRIGGER", "NAV_CONTAINER_LEFT"],
		["PADRTRIGGER", "NAV_CONTAINER_RIGHT"],
		["PADLSHOULDER", "NAV_PANEL_PREVIOUS"],
		["PADRSHOULDER", "NAV_PANEL_NEXT"],
	] as const) {
		const listener = vi.fn();
		events.subscribe(event, listener);
		expect(handler?.(key)).toBe(true);
		expect(listener).toHaveBeenCalledOnce();
	}
	expect(handler?.("PAD5")).toBe(false);
	modifier = true;
	expect(handler?.("PADDDOWN")).toBe(false);
	expect(handler?.("PAD1")).toBe(false);
	expect(down).toHaveBeenCalledOnce();
	expect(interact).toHaveBeenCalledOnce();
	modifier = false;
	const staleHandler = handler;
	combat = true;
	expect(staleHandler?.("PADDDOWN")).toBe(false);
	events.emit("COMBAT_STARTED");
	expect(handler).toBeUndefined();
	combat = false;
	events.emit("COMBAT_ENDED");
	expect(handler?.("PADDDOWN")).toBe(true);
	client.setActive(false);
	expect(handler).toBeUndefined();
	expect(staleHandler?.("PAD1")).toBe(false);
	client.shutdown();
	events.emit("COMBAT_ENDED");
	expect(surface.destroy).toHaveBeenCalledOnce();
	expect(handler).toBeUndefined();
});

it("configures quick repeats for D-pad directions only", () => {
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("IsModifierKeyDown", () => false);
	const events = createTestEventBus();
	const up = vi.fn();
	events.subscribe("NAV_UP", up);
	let downHandler: ((button: string) => boolean) | undefined;
	let repeatOptions:
		| {
				buttons: readonly string[];
				delaySeconds: number;
				intervalSeconds: number;
		  }
		| undefined;
	const surface: IGamePadInput = {
		setClickBindings: vi.fn(),
		setGamePadInput: vi.fn((down, _released, repeat) => {
			downHandler = down;
			repeatOptions = repeat;
		}),
		destroy: vi.fn(),
	};
	const client = new ControllerInputClient(events, surface);
	client.setActive(true);
	expect(downHandler?.("PADDUP")).toBe(true);
	expect(up).toHaveBeenCalledOnce();
	expect(repeatOptions).toEqual({
		buttons: ["PADDUP", "PADDDOWN", "PADDLEFT", "PADDRIGHT"],
		delaySeconds: 0.5,
		intervalSeconds: 0.05,
	});
	expect(downHandler?.("PAD1")).toBe(true);
	expect(up).toHaveBeenCalledOnce();
	client.shutdown();
});

it("disables D-pad repeat when navigation deactivates or combat starts", () => {
	let combat = false;
	vi.stubGlobal("InCombatLockdown", () => combat);
	vi.stubGlobal("IsModifierKeyDown", () => false);
	const events = createTestEventBus();
	const repeatOptions: (GamePadRepeatOptions | undefined)[] = [];
	const surface: IGamePadInput = {
		setClickBindings: vi.fn(),
		setGamePadInput: vi.fn((_callback, _released, repeat) => {
			repeatOptions.push(repeat);
		}),
		destroy: vi.fn(),
	};
	const client = new ControllerInputClient(events, surface);
	client.setActive(true);
	expect(repeatOptions.at(-1)).toBeDefined();
	client.setActive(false);
	expect(repeatOptions.at(-1)).toBeUndefined();

	client.setActive(true);
	combat = true;
	events.emit("COMBAT_STARTED");
	expect(repeatOptions.at(-1)).toBeUndefined();
	client.shutdown();
});

it("suspends combat modifiers during UI navigation and restores them on close, combat and shutdown", () => {
	let combat = false;
	vi.stubGlobal("InCombatLockdown", () => combat);
	vi.stubGlobal("hooksecurefunc", vi.fn());
	vi.stubGlobal("SetGamePadCursorControl", vi.fn());
	const set = vi.fn();
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) => `original-${name}`,
		SetCVar: set,
	});
	const events = createTestEventBus();
	const client = new ControllerInputClient(events, {
		setClickBindings: vi.fn(),
		setGamePadInput: vi.fn(),
		destroy: vi.fn(),
	});
	client.initialize();
	client.setActive(true);
	expect(set).toHaveBeenCalledWith("GamePadEmulateShift", "none");
	expect(set).toHaveBeenCalledWith("GamePadEmulateCtrl", "none");
	set.mockClear();
	client.setActive(true);
	expect(set).not.toHaveBeenCalled();
	combat = true;
	events.emit("COMBAT_STARTED");
	expect(set).toHaveBeenCalledWith("GamePadEmulateShift", "PADLTRIGGER");
	expect(set).toHaveBeenCalledWith("GamePadEmulateCtrl", "PADLSHOULDER");
	set.mockClear();
	combat = false;
	events.emit("COMBAT_ENDED");
	expect(set).toHaveBeenCalledWith("GamePadEmulateShift", "none");
	client.setActive(false);
	expect(set).toHaveBeenLastCalledWith("GamePadEmulateCtrl", "PADLSHOULDER");
	client.shutdown();
	expect(set).toHaveBeenCalledWith(
		"GamePadEmulateShift",
		"original-GamePadEmulateShift",
	);
});
