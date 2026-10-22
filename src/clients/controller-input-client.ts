import type { ApplicationEvent, IEventBus } from "../events/types";
import type { GamePadRepeatOptions } from "../ui/components/gamepad-input";
import type { ClickBinding } from "../ui/components/secure-click-bindings";
import type {
	NavDirection,
	SecureNavigationActions,
} from "../ui/navigation/types";
import type { IControllerOptionsClient } from "./controller-options-client";

// Undocumented globals used by Blizzard's UIParentPanelManager/Game.lua.
declare global {
	function IsGamePadCursorControlEnabled(this: void): boolean;
	function SetGamePadCursorControl(this: void, enabled: boolean): void;
	function hooksecurefunc(
		this: void,
		name: "SetGamePadCursorControl",
		callback: (this: void, enabled: boolean) => void,
	): void;
}

export interface IGamePadInput {
	setClickBindings(bindings: readonly ClickBinding[]): void;
	setGamePadInput(
		onButtonDown?: (button: string) => boolean,
		onButtonUp?: (button: string) => void,
		repeat?: GamePadRepeatOptions,
	): void;
	destroy(): void;
}
export interface IControllerInputClient {
	readonly options: IControllerOptionsClient;
	disableBuiltIn(): void;
	initialize(): void;
	setActive(active: boolean): void;
	setSecureActions(actions?: SecureNavigationActions): void;
	setBindingCapture(callback?: (this: void, key: string) => void): void;
	shutdown(): void;
}

const cursorSettings: Readonly<Record<string, string>> = {
	GamePadCursorAutoEnable: "0",
	GamePadCursorOnLogin: "0",
	GamePadCursorForTargeting: "0",
	GamePadCursorCenteredEmulation: "0",
	GamePadCursorLeftClick: "none",
	GamePadCursorRightClick: "none",
};
const controllerSettings: Readonly<Record<string, string>> = {
	GamePadEnable: "1",
	GamePadStickAxisButtons: "0",
	GamePadEmulateShift: "PADLTRIGGER",
	GamePadEmulateCtrl: "PADLSHOULDER",
	// Native modifier taps fire their action on release; chords cancel the tap.
	GamePadEmulateTapWindowMs: "350",
	GamePadEmulateAlt: "none",
};

const buttons: Readonly<Record<string, ApplicationEvent | undefined>> = {
	PADDUP: "NAV_UP",
	PADDDOWN: "NAV_DOWN",
	PADDLEFT: "NAV_LEFT",
	PADDRIGHT: "NAV_RIGHT",
	PADLSHOULDER: "NAV_PANEL_PREVIOUS",
	PADRSHOULDER: "NAV_PANEL_NEXT",
	PADLTRIGGER: "NAV_CONTAINER_LEFT",
	PADRTRIGGER: "NAV_CONTAINER_RIGHT",
	PAD4: "NAV_CONTEXT",
	PAD3: "NAV_INTERACT",
	PAD2: "NAV_CANCEL",
};

const directionalButtons = ["PADDUP", "PADDDOWN", "PADDLEFT", "PADDRIGHT"];
const directions: Readonly<Record<string, NavDirection | undefined>> = {
	PADDUP: "up",
	PADDDOWN: "down",
	PADDLEFT: "left",
	PADDRIGHT: "right",
};
const repeatOptions: GamePadRepeatOptions = {
	buttons: directionalButtons,
	delaySeconds: 0.5,
	intervalSeconds: 0.05,
};

/** Owns controller-specific names and publishes input through the injected bus. */
export class ControllerInputClient implements IControllerInputClient {
	private readonly originalCVars = new Map<string, string>();
	private originalCursorControl?: boolean;
	private configured = false;
	private cursorHooked = false;
	private active = false;
	private listening = false;
	private secureActions?: SecureNavigationActions;
	private capture?: (this: void, key: string) => void;
	private readonly capturedKeys = new Map<string, string>();
	private readonly captureModifiers = new Set<string>();
	private readonly usedCaptureModifiers = new Set<string>();
	setBindingCapture(callback?: (this: void, key: string) => void): void {
		this.capture = callback;
		this.capturedKeys.clear();
		this.captureModifiers.clear();
		this.usedCaptureModifiers.clear();
		this.releaseDirections();
		this.syncBindings();
	}
	private captureDown(button: string): boolean {
		if (!this.capture || !this.active || InCombatLockdown()) return false;
		if (button === "PADLTRIGGER" || button === "PADLSHOULDER") {
			this.captureModifiers.add(button);
			return true;
		}
		if (this.capturedKeys.has(button)) return true;
		const ctrl = this.captureModifiers.has("PADLSHOULDER");
		const shift = this.captureModifiers.has("PADLTRIGGER");
		for (const modifier of this.captureModifiers)
			this.usedCaptureModifiers.add(modifier);
		this.capturedKeys.set(
			button,
			`${ctrl ? "CTRL-" : ""}${shift ? "SHIFT-" : ""}${button}`,
		);
		return true;
	}
	private captureUp(button: string): void {
		if (!this.capture || !this.active || InCombatLockdown()) return;
		if (this.captureModifiers.delete(button)) {
			if (!this.usedCaptureModifiers.delete(button)) this.capture(button);
			return;
		}
		const key = this.capturedKeys.get(button);
		this.capturedKeys.delete(button);
		if (key) this.capture(key);
	}
	private readonly heldDirections = new Set<NavDirection>();
	private releaseDirections(): void {
		for (const direction of this.heldDirections)
			this.events.emit("NAV_DIRECTION_CHANGED", { direction, pressed: false });
		this.heldDirections.clear();
	}
	setSecureActions(actions?: SecureNavigationActions): void {
		this.secureActions = actions;
		this.syncBindings();
	}
	private syncBindings(): void {
		const bindings: ClickBinding[] = [];
		if (this.listening && !this.capture) {
			const target =
				this.secureActions?.alternate ?? this.secureActions?.interact;
			if (target) {
				const binding: ClickBinding = {
					key: "PAD3",
					target,
				};
				if (this.secureActions?.alternate && this.secureActions.alternateButton)
					binding.button = this.secureActions.alternateButton;
				bindings.push(binding);
			}
		}
		this.surface.setClickBindings(bindings);
	}
	private readonly sync = () => {
		const listening = this.active && !InCombatLockdown();
		if (listening === this.listening) return;
		this.listening = listening;
		if (!listening) this.releaseDirections();
		this.syncBindings();
		this.syncModifiers();
		this.surface.setGamePadInput(
			listening ? (button) => this.handleButtonDown(button) : undefined,
			listening
				? (button) => {
						if (this.capture) {
							this.captureUp(button);
							return;
						}
						const direction = directions[button];
						if (direction && this.heldDirections.delete(direction))
							this.events.emit("NAV_DIRECTION_CHANGED", {
								direction,
								pressed: false,
							});
					}
				: undefined,
			listening ? repeatOptions : undefined,
		);
	};
	private syncModifiers(): void {
		if (!this.configured) return;
		for (const name of ["GamePadEmulateShift", "GamePadEmulateCtrl"])
			if (this.originalCVars.has(name))
				C_CVar.SetCVar(
					name,
					this.listening ? "none" : controllerSettings[name],
				);
	}
	constructor(
		private readonly events: IEventBus,
		private readonly surface: IGamePadInput,
		readonly options: IControllerOptionsClient,
	) {
		events.subscribe("COMBAT_STARTED", this.sync);
		events.subscribe("COMBAT_ENDED", this.sync);
	}
	private canHandleInput(button: string): boolean {
		return (
			this.active &&
			!InCombatLockdown() &&
			(directions[button] !== undefined || !IsModifierKeyDown())
		);
	}
	private handleButtonDown(button: string): boolean {
		if (this.capture) return this.captureDown(button);
		if (!this.canHandleInput(button)) return false;
		const event = buttons[button];
		if (!event) return false;
		const direction = directions[button];
		if (direction && !this.heldDirections.has(direction)) {
			this.heldDirections.add(direction);
			this.events.emit("NAV_DIRECTION_CHANGED", { direction, pressed: true });
		}
		// Let the hardware event reach its secure binding, bypassing addon dispatch.
		if (
			button === "PAD3" &&
			(this.secureActions?.alternate || this.secureActions?.interact)
		)
			return false;
		this.events.emit(event);
		return true;
	}
	private configure(settings: Readonly<Record<string, string>>): void {
		for (const [name, value] of Object.entries(settings)) {
			if (this.originalCVars.has(name)) continue;
			const original = C_CVar.GetCVar(name);
			if (original === null || original === undefined) continue;
			this.originalCVars.set(name, original);
			C_CVar.SetCVar(name, value);
		}
	}
	disableBuiltIn(): void {
		if (this.originalCursorControl === undefined)
			this.originalCursorControl = IsGamePadCursorControlEnabled();
		this.configure(cursorSettings);
		SetGamePadCursorControl(false);
	}
	initialize(): void {
		this.configured = true;
		if (!this.cursorHooked) {
			this.cursorHooked = true;
			hooksecurefunc("SetGamePadCursorControl", (enabled: boolean) => {
				if (this.configured && enabled) SetGamePadCursorControl(false);
			});
		}
		this.configure(controllerSettings);
		this.options.initialize();
		if (this.listening) this.syncModifiers();
		// Enabling the device must not put the right stick back into cursor mode.
		SetGamePadCursorControl(false);
	}
	setActive(active: boolean): void {
		this.active = active;
		this.sync();
	}
	shutdown(): void {
		this.options.shutdown();
		this.setBindingCapture();
		this.configured = false;
		this.events.unsubscribe("COMBAT_STARTED", this.sync);
		this.events.unsubscribe("COMBAT_ENDED", this.sync);
		this.setActive(false);
		this.surface.destroy();
		for (const [name, value] of this.originalCVars) C_CVar.SetCVar(name, value);
		this.originalCVars.clear();
		if (this.originalCursorControl !== undefined) {
			SetGamePadCursorControl(this.originalCursorControl);
			this.originalCursorControl = undefined;
		}
	}
}
