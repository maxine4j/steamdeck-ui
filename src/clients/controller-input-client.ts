import type { ApplicationEvent, IEventBus } from "../events/types";
import type { GamePadRepeatOptions } from "../ui/components/gamepad-input";
import type { ClickBinding } from "../ui/components/secure-click-bindings";
import type {
	NavDirection,
	SecureNavigationActions,
} from "../ui/navigation/types";

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
	disableBuiltIn(): void;
	initialize(): void;
	setActive(active: boolean): void;
	setSecureActions(actions?: SecureNavigationActions): void;
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
	GamePadAnalogMovement: "1",
	// Retail's facing CVars: 0 always faces movement, including in combat.
	GamePadFaceMovementMaxAngle: "0",
	GamePadFaceMovementMaxAngleCombat: "0",
	GamePadTurnWithCamera: "0",
	GamePadTankTurnSpeed: "0",
	GamePadStickAxisButtons: "0",
	GamePadCameraYawSpeed: "1",
	GamePadCameraPitchSpeed: "1",
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
	PAD1: "NAV_INTERACT",
	PAD4: "NAV_CONTEXT",
	PAD3: "NAV_ALTERNATE",
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
		if (this.listening) {
			if (this.secureActions?.interact)
				bindings.push({ key: "PAD1", target: this.secureActions.interact });
			if (this.secureActions?.alternate) {
				const binding: ClickBinding = {
					key: "PAD3",
					target: this.secureActions.alternate,
				};
				if (this.secureActions.alternateButton)
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
	) {
		events.subscribe("COMBAT_STARTED", this.sync);
		events.subscribe("COMBAT_ENDED", this.sync);
	}
	private canHandleInput(): boolean {
		return this.active && !InCombatLockdown() && !IsModifierKeyDown();
	}
	private handleButtonDown(button: string): boolean {
		if (!this.canHandleInput()) return false;
		const event = buttons[button];
		if (!event) return false;
		const direction = directions[button];
		if (direction && !this.heldDirections.has(direction)) {
			this.heldDirections.add(direction);
			this.events.emit("NAV_DIRECTION_CHANGED", { direction, pressed: true });
		}
		// Let the hardware event reach its secure binding, bypassing addon dispatch.
		if (
			(button === "PAD1" && this.secureActions?.interact) ||
			(button === "PAD3" && this.secureActions?.alternate)
		)
			return false;
		this.events.emit(event);
		return true;
	}
	private configure(settings: Readonly<Record<string, string>>): void {
		for (const [name, value] of Object.entries(settings)) {
			if (this.originalCVars.has(name)) continue;
			const original = C_CVar.GetCVar(name);
			if (original === null) continue;
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
		if (this.listening) this.syncModifiers();
		// Enabling the device must not put the right stick back into cursor mode.
		SetGamePadCursorControl(false);
	}
	setActive(active: boolean): void {
		this.active = active;
		this.sync();
	}
	shutdown(): void {
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
