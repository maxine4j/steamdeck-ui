import type { IEventBus } from "../events/types";
import type {
	NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";
import type { ITaskScheduler } from "./task-scheduler";

interface PlayerChoiceFrame extends NativeDialogFrame {
	optionFrames: NativeDialogFrame[];
	OnCloseUIFromExitButton(): void;
}

/** Shared Retail choice UI: normal responses, power choices and grid cards. */
export class PlayerChoiceClient implements INativeDialogsClient {
	private active = false;
	private readonly hooked = new Set<PlayerChoiceFrame>();
	private cancelPending?: () => void;
	constructor(
		private readonly events: IEventBus,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "grid" | "release"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.discover();
	}
	private host(): PlayerChoiceFrame | undefined {
		return (_G as unknown as { PlayerChoiceFrame?: PlayerChoiceFrame })
			.PlayerChoiceFrame;
	}
	private readonly changed = () => {
		if (!this.active || this.cancelPending) return;
		this.cancelPending = this.scheduler.nextFrame(() => {
			this.cancelPending = undefined;
			if (this.active) this.events.emit("NATIVE_DIALOGS_CHANGED");
		});
	};
	private readonly discover = () => {
		const host = this.host();
		if (!this.active || !host) return;
		this.controls.watch(host, this.changed);
		if (!this.hooked.has(host)) {
			this.hooked.add(host);
			const hook = hooksecurefunc as unknown as (
				this: void,
				frame: PlayerChoiceFrame,
				method: string,
				callback: (this: void) => void,
			) => void;
			for (const method of ["SetupOptions", "OnPageChanged"])
				hook(host, method, () => this.changed());
		}
		this.changed();
	};
	getDialogs(): NativeDialog[] {
		const host = this.host();
		if (!this.active || !host?.IsVisible()) return [];
		return [
			{
				id: "native-player-choice",
				grid: this.controls.grid(
					"player-choice",
					host,
					false,
					undefined,
					(frame) => {
						// Response buttons carry both fields; preview and reward buttons do not.
						const response = frame as NativeDialogFrame & {
							buttonID?: number;
							parentOption?: NativeDialogFrame;
						};
						return (
							(response.buttonID !== undefined &&
								response.parentOption !== undefined) ||
							host.optionFrames.includes(frame)
						);
					},
				),
				cancel: () => {
					// Blizzard enforces requiresSelection here and owns the close sound.
					if (this.active && host.IsVisible()) host.OnCloseUIFromExitButton();
				},
			},
		];
	}
	shutdown(): void {
		this.active = false;
		this.events.unsubscribe("DIALOGUE_ADDON_LOADED", this.discover);
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.controls.release();
	}
}
