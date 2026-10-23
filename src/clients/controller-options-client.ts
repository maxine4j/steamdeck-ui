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
const styles: readonly ControllerChoice[] = [
	{ value: "face", label: "Face movement stick" },
	{ value: "backpedal", label: "Strafe and backpedal" },
	{ value: "mixed", label: "Strafe, then face stick" },
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
	"Face stick turns toward travel. Strafe and backpedal preserves facing. Strafe, then face stick turns toward movement beyond 120°.";
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
];
const movementCVars = [
	"GamePadFaceMovementMaxAngle",
	"GamePadFaceMovementMaxAngleCombat",
	"GamePadTankTurnSpeed",
	"GamePadTurnWithCamera",
	"GamePadAnalogMovement",
];
const stateEvents: readonly ApplicationEvent[] = [
	"COMBAT_STARTED",
	"COMBAT_ENDED",
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
		this.write("GamePadAnalogMovement", "1");
		const angle = (style: string) =>
			style === "face" ? "0" : style === "mixed" ? "120" : "180";
		this.write(
			"GamePadFaceMovementMaxAngle",
			angle(this.option("travelStyle")),
		);
		this.write(
			"GamePadFaceMovementMaxAngleCombat",
			angle(this.option("combatStyle")),
		);
		this.write("GamePadTankTurnSpeed", "0");
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
