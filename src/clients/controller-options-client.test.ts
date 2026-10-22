import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { ControllerOptionsClient } from "./controller-options-client";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const values = new Map<string, string>();
	const set = vi.fn((name: string, value: string) => values.set(name, value));
	let combat = false;
	let mounted = false;
	let canGlide = false;
	vi.stubGlobal("SteamDeckUIConfig", {});
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) => values.get(name) ?? "0",
		SetCVar: set,
	});
	vi.stubGlobal("InCombatLockdown", () => combat);
	vi.stubGlobal("IsMounted", () => mounted);
	vi.stubGlobal("C_PlayerInfo", { GetGlidingInfo: () => [false, canGlide, 0] });
	const events = createTestEventBus();
	const client = new ControllerOptionsClient(events);
	return {
		client,
		events,
		values,
		set,
		combat: (value: boolean) => {
			combat = value;
		},
		mount: (value: boolean, glide: boolean) => {
			mounted = value;
			canGlide = glide;
		},
	};
}

it("persists edits across reload, reapplies them once and restores the original CVars on shutdown", () => {
	const { client, values, set, events } = setup();
	values.set("GamePadCameraYawSpeed", "2");
	client.initialize();
	client.set("yawSpeed", "1.5");
	client.set("travelStyle", "tank");
	expect(values.get("GamePadCameraYawSpeed")).toBe("1.5");
	expect(values.get("GamePadTankTurnSpeed")).toBe("1");
	set.mockClear();
	client.initialize();
	expect(set).not.toHaveBeenCalled();
	client.shutdown();
	expect(values.get("GamePadCameraYawSpeed")).toBe("2");
	const reloaded = new ControllerOptionsClient(events);
	reloaded.initialize();
	expect(values.get("GamePadCameraYawSpeed")).toBe("1.5");
	expect(values.get("GamePadTankTurnSpeed")).toBe("1");
});

it("uses editable travel and combat strafe angles for the mixed movement style", () => {
	const { client, values } = setup();
	client.initialize();
	client.set("travelStyle", "mixed");
	client.set("combatStyle", "mixed");
	client.set("travelAngle", "45");
	client.set("combatAngle", "135");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("45");
	expect(values.get("GamePadFaceMovementMaxAngleCombat")).toBe("135");
	client.set("travelStyle", "face");
	client.set("combatStyle", "backpedal");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("0");
	expect(values.get("GamePadFaceMovementMaxAngleCombat")).toBe("180");
});

it("supports the usual five-percent walk threshold steps and preserves explicitly selected camera comfort after reload", () => {
	const { client, values, events } = setup();
	client.initialize();
	client.set("runThreshold", "0.55");
	expect(
		client
			.getOptions()
			.find((option) => option.id === "runThreshold")
			?.choices.map((choice) => choice.value),
	).toEqual([
		"0",
		"0.05",
		"0.1",
		"0.15",
		"0.2",
		"0.25",
		"0.3",
		"0.35",
		"0.4",
		"0.45",
		"0.5",
		"0.55",
		"0.6",
		"0.65",
		"0.7",
		"0.75",
		"0.8",
		"0.85",
		"0.9",
		"0.95",
		"1",
	]);
	client.set("shoulder", "-0.5");
	expect(values.get("GamePadRunThreshold")).toBe("0.55");
	client.shutdown();
	const reloaded = new ControllerOptionsClient(events);
	reloaded.initialize();
	expect(values.get("GamePadRunThreshold")).toBe("0.55");
	expect(values.get("test_cameraOverShoulder")).toBe("-0.5");
	reloaded.shutdown();
	reloaded.initialize();
	expect(values.get("test_cameraOverShoulder")).toBe("-0.5");
});

it("switches travel/combat tank behaviour and camera facing, with a distinct mounted skyriding override", () => {
	const { client, events, values, combat, mount, set } = setup();
	client.initialize();
	client.set("travelStyle", "face");
	client.set("combatStyle", "tank");
	client.set("skyridingStyle", "backpedal");
	client.set("turnWithCamera", "outOfCombat");
	expect(values.get("GamePadTurnWithCamera")).toBe("2");
	combat(true);
	events.emit("COMBAT_STARTED");
	expect(values.get("GamePadTankTurnSpeed")).toBe("1");
	expect(values.get("GamePadTurnWithCamera")).toBe("0");
	mount(true, false);
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(values.get("GamePadTankTurnSpeed")).toBe("1");
	// Standing on a skyriding mount counts, even before gliding starts.
	mount(true, true);
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(values.get("GamePadTankTurnSpeed")).toBe("0");
	expect(values.get("GamePadFaceMovementMaxAngleCombat")).toBe("180");
	mount(false, true);
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(values.get("GamePadTankTurnSpeed")).toBe("1");
	combat(false);
	events.emit("COMBAT_ENDED");
	expect(values.get("GamePadTurnWithCamera")).toBe("2");
	expect(values.get("GamePadTankTurnSpeed")).toBe("0");
	client.shutdown();
	set.mockClear();
	events.emit("COMBAT_STARTED");
	expect(set).not.toHaveBeenCalled();
});

it("preserves optional camera preferences until selected, validates saves and safely skips unavailable CVars", () => {
	const { client, values, set } = setup();
	values.set("test_cameraDynamicPitch", "1");
	values.set("test_cameraOverShoulder", "0.5");
	SteamDeckUIConfig = {
		controllerOptions: { yawSpeed: "invalid", unknown: "9" },
	};
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) =>
			name === "gamepadInvertYaw"
				? undefined
				: name === "GamePadCameraLookMaxYaw"
					? null
					: (values.get(name) ?? "0"),
		SetCVar: set,
	});
	client.initialize();
	expect(set).not.toHaveBeenCalledWith(
		"test_cameraDynamicPitch",
		expect.anything(),
	);
	expect(set).not.toHaveBeenCalledWith(
		"test_cameraOverShoulder",
		expect.anything(),
	);
	expect(values.get("GamePadCameraYawSpeed")).toBe("1");
	expect(
		client.getOptions().find((option) => option.id === "invertYaw")?.supported,
	).toBe(false);
	client.set("invertYaw", "1");
	client.set("yawSpeed", "bad");
	expect(set).not.toHaveBeenCalledWith("gamepadInvertYaw", expect.anything());
	client.set("dynamicPitch", "0");
	expect(values.get("test_cameraDynamicPitch")).toBe("0");
	client.reset();
	expect(values.get("test_cameraDynamicPitch")).toBe("1");
	expect(values.get("test_cameraOverShoulder")).toBe("0.5");
	expect(SteamDeckUIConfig?.controllerOptions).toEqual({});
});
