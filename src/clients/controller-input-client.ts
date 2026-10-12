import type { ApplicationEvent, IEventBus } from "../events/types";

export interface IGamePadInput {
	setGamePadInput(callback?: (button: string) => boolean): void;
	destroy(): void;
}
export interface IControllerInputClient {
	setActive(active: boolean): void;
	shutdown(): void;
}

const buttons: Readonly<Record<string, ApplicationEvent | undefined>> = {
	PADDUP: "NAV_UP",
	PADDDOWN: "NAV_DOWN",
	PADDLEFT: "NAV_LEFT",
	PADDRIGHT: "NAV_RIGHT",
	PAD1: "NAV_INTERACT",
};

/** Owns controller-specific names and publishes input through the injected bus. */
export class ControllerInputClient implements IControllerInputClient {
	private active = false;
	private listening = false;
	private readonly sync = () => {
		const listening = this.active && !InCombatLockdown();
		if (listening === this.listening) return;
		this.listening = listening;
		this.surface.setGamePadInput(
			listening
				? (button) => {
						if (!this.active || InCombatLockdown() || IsModifierKeyDown())
							return false;
						const event = buttons[button];
						if (!event) return false;
						this.events.emit(event);
						return true;
					}
				: undefined,
		);
	};
	constructor(
		private readonly events: IEventBus,
		private readonly surface: IGamePadInput,
	) {
		events.subscribe("COMBAT_STARTED", this.sync);
		events.subscribe("COMBAT_ENDED", this.sync);
	}
	setActive(active: boolean): void {
		this.active = active;
		this.sync();
	}
	shutdown(): void {
		this.events.unsubscribe("COMBAT_STARTED", this.sync);
		this.events.unsubscribe("COMBAT_ENDED", this.sync);
		this.setActive(false);
		this.surface.destroy();
	}
}
