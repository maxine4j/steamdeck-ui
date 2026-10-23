import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { ControllerOptionsClient } from "./controller-options-client";

afterEach(() => vi.unstubAllGlobals());

it("offers only the five requested settings and three movement styles", () => {
	const { client } = setup();
	client.initialize();
	expect(client.getOptions().map((option) => option.id)).toEqual([
		"travelStyle",
		"combatStyle",
		"turnWithCamera",
		"yawSpeed",
		"pitchSpeed",
	]);
	for (const option of client
		.getOptions()
		.filter((option) => option.id.endsWith("Style"))) {
		expect(option.category).toBe("Movement");
		expect(option.choices.map((choice) => choice.value)).toEqual([
			"face",
			"backpedal",
			"mixed",
		]);
	}
});

it("enforces analog movement and fixed mixed angles at login despite old saved settings", () => {
	const { client, values, set } = setup();
	SteamDeckUIConfig = {
		controllerOptions: {
			travelStyle: "mixed",
			combatStyle: "mixed",
			travelAngle: "45",
			combatAngle: "135",
			analog: "0",
			skyridingStyle: "tank",
			tankSpeed: "3",
			follow: "1",
			lookYaw: "90",
			invertPitch: "1",
		},
	};
	client.initialize();
	expect(values.get("GamePadAnalogMovement")).toBe("1");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("120");
	expect(values.get("GamePadFaceMovementMaxAngleCombat")).toBe("120");
	expect(values.get("GamePadTankTurnSpeed")).toBe("0");
	expect(set).not.toHaveBeenCalledWith(
		"CameraFollowOnStick",
		expect.anything(),
	);
	expect(set).not.toHaveBeenCalledWith(
		"GamePadCameraLookMaxYaw",
		expect.anything(),
	);
	expect(set).not.toHaveBeenCalledWith("gamepadInvertPitch", expect.anything());
	client.set("travelAngle", "45");
	client.set("analog", "0");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("120");
	expect(values.get("GamePadAnalogMovement")).toBe("1");
});

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
	client.set("travelStyle", "mixed");
	expect(values.get("GamePadCameraYawSpeed")).toBe("1.5");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("120");
	set.mockClear();
	client.initialize();
	expect(set).not.toHaveBeenCalled();
	client.shutdown();
	expect(values.get("GamePadCameraYawSpeed")).toBe("2");
	const reloaded = new ControllerOptionsClient(events);
	reloaded.initialize();
	expect(values.get("GamePadCameraYawSpeed")).toBe("1.5");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("120");
});

it("uses fixed travel and combat strafe angles for the mixed movement style", () => {
	const { client, values } = setup();
	client.initialize();
	client.set("travelStyle", "mixed");
	client.set("combatStyle", "mixed");
	client.set("travelAngle", "45");
	client.set("combatAngle", "135");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("120");
	expect(values.get("GamePadFaceMovementMaxAngleCombat")).toBe("120");
	client.set("travelStyle", "face");
	client.set("combatStyle", "backpedal");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("0");
	expect(values.get("GamePadFaceMovementMaxAngleCombat")).toBe("180");
});

it("switches camera facing with combat and detaches on shutdown", () => {
	const { client, events, values, combat, set } = setup();
	client.initialize();
	client.set("turnWithCamera", "always");
	expect(values.get("GamePadTurnWithCamera")).toBe("2");
	client.set("turnWithCamera", "combat");
	expect(values.get("GamePadTurnWithCamera")).toBe("1");
	client.set("turnWithCamera", "outOfCombat");
	expect(values.get("GamePadTurnWithCamera")).toBe("2");
	combat(true);
	events.emit("COMBAT_STARTED");
	expect(values.get("GamePadTurnWithCamera")).toBe("0");
	combat(false);
	events.emit("COMBAT_ENDED");
	expect(values.get("GamePadTurnWithCamera")).toBe("2");
	client.shutdown();
	set.mockClear();
	events.emit("COMBAT_STARTED");
	expect(set).not.toHaveBeenCalled();
});

it("rejects invalid and removed saves, skips unavailable CVars and resets defaults", () => {
	const { client, values, set } = setup();
	SteamDeckUIConfig = {
		controllerOptions: {
			yawSpeed: "invalid",
			travelStyle: "tank",
			unknown: "9",
		},
	};
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) =>
			name === "GamePadCameraPitchSpeed"
				? undefined
				: name === "GamePadAnalogMovement"
					? null
					: (values.get(name) ?? "0"),
		SetCVar: set,
	});
	client.initialize();
	expect(
		client.getOptions().find((option) => option.id === "pitchSpeed")?.supported,
	).toBe(false);
	expect(
		client.getOptions().find((option) => option.id === "travelStyle")?.value,
	).toBe("face");
	client.set("pitchSpeed", "2");
	client.set("yawSpeed", "bad");
	client.set("travelStyle", "tank");
	expect(set).not.toHaveBeenCalledWith(
		"GamePadCameraPitchSpeed",
		expect.anything(),
	);
	expect(set).not.toHaveBeenCalledWith(
		"GamePadAnalogMovement",
		expect.anything(),
	);
	expect(values.get("GamePadCameraYawSpeed")).toBe("1");
	client.set("yawSpeed", "2.25");
	client.set("travelStyle", "mixed");
	client.reset();
	expect(values.get("GamePadCameraYawSpeed")).toBe("1");
	expect(values.get("GamePadFaceMovementMaxAngle")).toBe("0");
	expect(SteamDeckUIConfig?.controllerOptions).toEqual({});
});
