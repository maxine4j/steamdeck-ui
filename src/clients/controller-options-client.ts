import type { ApplicationEvent, IEventBus } from "../events/types";
import "./addon-config-client";

export interface ControllerChoice {
	readonly value: string;
	readonly label: string;
}
export interface ControllerOption {
	readonly id: string;
	readonly category: string;
	readonly label: string;
	readonly description: string;
	readonly choices: readonly ControllerChoice[];
	readonly value: string;
	readonly supported: boolean;
}
export interface IControllerOptionsClient {
	initialize(): void;
	shutdown(): void;
	getOptions(): readonly ControllerOption[];
	set(id: string, value: string): void;
	reset(): void;
}
interface Definition {
	id: string;
	category: string;
	label: string;
	description: string;
	choices: readonly ControllerChoice[];
	cvar?: string;
	default?: string;
}
const toggle: readonly ControllerChoice[] = [
	{ value: "0", label: "Off" },
	{ value: "1", label: "On" },
];
const styles: readonly ControllerChoice[] = [
	{ value: "face", label: "Face movement stick" },
	{ value: "mixed", label: "Strafe, then face stick" },
	{ value: "backpedal", label: "Strafe and backpedal" },
	{ value: "tank", label: "Tank turn and backpedal" },
];
function range(
	minimum: number,
	maximum: number,
	step: number,
	suffix = "",
): ControllerChoice[] {
	const choices: ControllerChoice[] = [];
	for (
		let index = 0;
		index <= Math.round((maximum - minimum) / step);
		index++
	) {
		const value = Math.round((minimum + index * step) * 1000) / 1000;
		choices.push({ value: `${value}`, label: `${value}${suffix}` });
	}
	return choices;
}
const movementDescription =
	"Face stick turns toward travel. Strafe keeps facing and walks backward. Tank turns with the left stick. Set both travel and combat for always-on behaviour.";
const definitions: readonly Definition[] = [
	{
		id: "travelStyle",
		category: "Player control",
		label: "Movement outside combat",
		description: movementDescription,
		choices: styles,
		default: "face",
	},
	{
		id: "combatStyle",
		category: "Player control",
		label: "Movement in combat",
		description: movementDescription,
		choices: styles,
		default: "face",
	},
	{
		id: "travelAngle",
		category: "Player control",
		label: "Travel strafe angle",
		description:
			"Used by the strafe-then-face style outside combat. Beyond this stick angle, turn toward movement. Zero always faces movement; 180 always strafes.",
		choices: range(0, 180, 5, "°"),
		default: "90",
	},
	{
		id: "combatAngle",
		category: "Player control",
		label: "Combat strafe angle",
		description:
			"Used by the strafe-then-face style in combat. Beyond this stick angle, turn toward movement. Zero always faces movement; 180 always strafes.",
		choices: range(0, 180, 5, "°"),
		default: "90",
	},
	{
		id: "skyridingStyle",
		category: "Player control",
		label: "Movement on skyriding mounts",
		description:
			"Overrides travel and combat while on a skyriding mount, including while standing on the ground. Other mounts use the normal styles.",
		choices: [
			{ value: "inherit", label: "Use travel / combat style" },
			...styles,
		],
		default: "inherit",
	},
	{
		id: "analog",
		category: "Player control",
		label: "Analog movement",
		description:
			"Use the full stick direction instead of discrete legacy movement.",
		choices: toggle,
		cvar: "GamePadAnalogMovement",
		default: "1",
	},
	{
		id: "runThreshold",
		category: "Player control",
		label: "Walk to run threshold",
		description:
			"Fraction of the movement stick radius needed to start running.",
		choices: range(0, 1, 0.05),
		cvar: "GamePadRunThreshold",
	},
	{
		id: "tankSpeed",
		category: "Player control",
		label: "Tank turn speed",
		description: "Left stick turn rate when a tank movement style is active.",
		choices: range(0.25, 4, 0.25),
		default: "1",
	},
	{
		id: "turnWithCamera",
		category: "Camera control",
		label: "Camera turns character",
		description: "Choose when turning the camera also turns your character.",
		choices: [
			{ value: "never", label: "Never" },
			{ value: "combat", label: "In combat" },
			{ value: "always", label: "Always" },
			{ value: "outOfCombat", label: "Outside combat" },
		],
		default: "never",
	},
	{
		id: "yawSpeed",
		category: "Camera control",
		label: "Horizontal sensitivity",
		description: "Right stick camera turning speed.",
		choices: range(0.5, 4, 0.25),
		cvar: "GamePadCameraYawSpeed",
		default: "1",
	},
	{
		id: "pitchSpeed",
		category: "Camera control",
		label: "Vertical sensitivity",
		description: "Right stick camera pitch speed.",
		choices: range(0.5, 4, 0.25),
		cvar: "GamePadCameraPitchSpeed",
		default: "1",
	},
	{
		id: "invertYaw",
		category: "Camera control",
		label: "Invert horizontal camera",
		description: "Reverse left and right camera input.",
		choices: toggle,
		cvar: "gamepadInvertYaw",
	},
	{
		id: "invertPitch",
		category: "Camera control",
		label: "Invert vertical camera",
		description: "Reverse up and down camera input.",
		choices: toggle,
		cvar: "gamepadInvertPitch",
	},
	{
		id: "centered",
		category: "Camera comfort",
		label: "Keep character centered",
		description:
			"Reduce motion sickness by centering your character. Incompatible with dynamic pitch and shoulder offset.",
		choices: toggle,
		cvar: "CameraKeepCharacterCentered",
	},
	{
		id: "reduceMotion",
		category: "Camera comfort",
		label: "Reduce unexpected camera motion",
		description: "Reduce unexpected movement of the camera.",
		choices: toggle,
		cvar: "CameraReduceUnexpectedMovement",
	},
	{
		id: "dynamicPitch",
		category: "Camera comfort",
		label: "Dynamic pitch",
		description:
			"Experimental: pitch upward as you zoom out. Turn off character centering to use this.",
		choices: toggle,
		cvar: "test_cameraDynamicPitch",
	},
	{
		id: "shoulder",
		category: "Camera comfort",
		label: "Shoulder offset",
		description:
			"Experimental: shift the camera sideways. Turn off character centering to use this.",
		choices: range(-1, 1, 0.5),
		cvar: "test_cameraOverShoulder",
	},
	{
		id: "follow",
		category: "Camera follow",
		label: "Follow movement stick",
		description:
			"Automatically adjust the camera while moving with the left stick.",
		choices: toggle,
		cvar: "CameraFollowOnStick",
	},
	{
		id: "followDelay",
		category: "Camera follow",
		label: "Follow delay",
		description: "Idle camera time before automatic adjustment starts.",
		choices: range(0, 5, 0.25, "s"),
		cvar: "CameraFollowGamepadAdjustDelay",
	},
	{
		id: "followEase",
		category: "Camera follow",
		label: "Follow ease in",
		description:
			"Time to ease from idle camera control into automatic adjustment.",
		choices: range(0, 5, 0.25, "s"),
		cvar: "CameraFollowGamepadAdjustEaseIn",
	},
	{
		id: "lookYaw",
		category: "Camera look",
		label: "Temporary look horizontal limit",
		description: "Maximum temporary camera yaw based on analog look input.",
		choices: range(-180, 180, 15, "°"),
		cvar: "GamePadCameraLookMaxYaw",
	},
	{
		id: "lookPitch",
		category: "Camera look",
		label: "Temporary look vertical limit",
		description: "Maximum temporary camera pitch based on analog look input.",
		choices: range(0, 90, 5, "°"),
		cvar: "GamePadCameraLookMaxPitch",
	},
];
const movementCVars = [
	"GamePadFaceMovementMaxAngle",
	"GamePadFaceMovementMaxAngleCombat",
	"GamePadTankTurnSpeed",
	"GamePadTurnWithCamera",
];
const stateEvents: readonly ApplicationEvent[] = [
	"COMBAT_STARTED",
	"COMBAT_ENDED",
	"SKYRIDING_STATE_CHANGED",
];

/** Sole owner of player movement and camera CVars, including runtime conditionals. */
export class ControllerOptionsClient implements IControllerOptionsClient {
	private active = false;
	private readonly originals = new Map<string, string>();
	private readonly written = new Map<string, string>();
	private readonly selected = new Map<string, string>();
	constructor(private readonly events: IEventBus) {}
	initialize(): void {
		if (this.active) return;
		this.active = true;
		SteamDeckUIConfig ??= {};
		for (const name of [
			...movementCVars,
			...definitions.flatMap((definition) =>
				definition.cvar ? [definition.cvar] : [],
			),
		]) {
			const original = C_CVar.GetCVar(name);
			if (original !== undefined && original !== null)
				this.originals.set(name, original);
		}
		for (const definition of definitions) {
			const saved = SteamDeckUIConfig.controllerOptions?.[definition.id];
			if (
				saved !== undefined &&
				definition.choices.some((choice) => choice.value === saved)
			)
				this.selected.set(definition.id, saved);
		}
		for (const event of stateEvents) this.events.subscribe(event, this.apply);
		this.apply();
	}
	private value(definition: Definition): string {
		return (
			this.selected.get(definition.id) ??
			definition.default ??
			(definition.cvar ? this.originals.get(definition.cvar) : undefined) ??
			"0"
		);
	}
	private supported(definition: Definition): boolean {
		if (definition.cvar) return this.originals.has(definition.cvar);
		if (definition.id === "turnWithCamera")
			return this.originals.has("GamePadTurnWithCamera");
		if (definition.id === "tankSpeed")
			return this.originals.has("GamePadTankTurnSpeed");
		return movementCVars.slice(0, 3).every((name) => this.originals.has(name));
	}
	getOptions(): readonly ControllerOption[] {
		return definitions.map((definition) => ({
			...definition,
			value: this.value(definition),
			supported: this.supported(definition),
		}));
	}
	set(id: string, value: string): void {
		const definition = definitions.find((option) => option.id === id);
		if (
			!this.active ||
			!definition ||
			!this.supported(definition) ||
			!definition.choices.some((choice) => choice.value === value)
		)
			return;
		this.selected.set(id, value);
		SteamDeckUIConfig ??= {};
		SteamDeckUIConfig.controllerOptions ??= {};
		SteamDeckUIConfig.controllerOptions[id] = value;
		this.apply();
	}
	reset(): void {
		if (!this.active) return;
		this.selected.clear();
		SteamDeckUIConfig ??= {};
		SteamDeckUIConfig.controllerOptions = {};
		for (const definition of definitions) {
			if (
				!definition.cvar ||
				definition.default !== undefined ||
				!this.written.has(definition.cvar)
			)
				continue;
			const original = this.originals.get(definition.cvar);
			if (original !== undefined) this.write(definition.cvar, original);
		}
		this.apply();
	}
	private write(name: string, value: string): void {
		if (!this.originals.has(name) || this.written.get(name) === value) return;
		C_CVar.SetCVar(name, value);
		this.written.set(name, value);
	}
	private option(id: string): string {
		const definition = definitions.find((option) => option.id === id);
		return definition ? this.value(definition) : "0";
	}
	private readonly apply = () => {
		if (!this.active) return;
		for (const definition of definitions)
			if (
				definition.cvar &&
				(definition.default !== undefined || this.selected.has(definition.id))
			)
				this.write(definition.cvar, this.value(definition));
		const combat = InCombatLockdown();
		let canGlide = false;
		if (typeof C_PlayerInfo !== "undefined")
			[, canGlide] = C_PlayerInfo.GetGlidingInfo();
		const sky =
			typeof IsMounted !== "undefined" &&
			IsMounted() &&
			canGlide &&
			this.option("skyridingStyle") !== "inherit";
		const travel = this.option(sky ? "skyridingStyle" : "travelStyle");
		const fighting = this.option(sky ? "skyridingStyle" : "combatStyle");
		const angle = (style: string, id: string) =>
			style === "face" ? "0" : style === "mixed" ? this.option(id) : "180";
		this.write("GamePadFaceMovementMaxAngle", angle(travel, "travelAngle"));
		this.write(
			"GamePadFaceMovementMaxAngleCombat",
			angle(fighting, "combatAngle"),
		);
		this.write(
			"GamePadTankTurnSpeed",
			(combat ? fighting : travel) === "tank" ? this.option("tankSpeed") : "0",
		);
		const mode = this.option("turnWithCamera");
		this.write(
			"GamePadTurnWithCamera",
			mode === "always" || (mode === "outOfCombat" && !combat)
				? "2"
				: mode === "combat"
					? "1"
					: "0",
		);
	};
	shutdown(): void {
		if (!this.active) return;
		this.active = false;
		for (const event of stateEvents) this.events.unsubscribe(event, this.apply);
		for (const name of this.written.keys()) {
			const original = this.originals.get(name);
			if (original !== undefined) C_CVar.SetCVar(name, original);
		}
		this.originals.clear();
		this.written.clear();
		this.selected.clear();
	}
}
