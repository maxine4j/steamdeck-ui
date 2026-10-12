import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import {
	ControllerInputClient,
	type IGamePadInput,
} from "./controller-input-client";

afterEach(() => vi.unstubAllGlobals());

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
	for (const key of ["PADRTRIGGER", "PADRSHOULDER"])
		expect(handler?.(key)).toBe(false);
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
