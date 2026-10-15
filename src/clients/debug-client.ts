import type { IEventBus } from "../events/types";
import { Diagnostics } from "./diagnostics";
import type { ITaskScheduler } from "./task-scheduler";

// Lua runtime globals are not part of the generated WoW API surface.
declare global {
	function geterrorhandler(this: void): (this: void, message: string) => void;
	function seterrorhandler(
		this: void,
		handler: (this: void, message: string) => void,
	): void;
	function debugstack(
		this: void,
		start?: number,
		top?: number,
		bottom?: number,
	): string;
}

export class DebugClient {
	readonly diagnostics = new Diagnostics(() => GetServerTime());
	private previous?: (this: void, message: string) => void;
	private cancelOpen?: () => void;
	private handling = false;
	private readonly handleError: (this: void, message: string) => void = (
		message,
	) => {
		if (this.handling) return;
		this.handling = true;
		try {
			this.diagnostics.log("error", `${message}\n${debugstack(2, 30, 10)}`);
			if (!this.cancelOpen)
				this.cancelOpen = this.scheduler.nextFrame(() => {
					this.cancelOpen = undefined;
					// Avoid an error in the debug UI recursively reopening that same UI.
					this.handling = true;
					try {
						this.events.emit("DEBUG_OPEN_REQUESTED");
					} finally {
						this.handling = false;
					}
				});
			this.previous?.(message);
		} finally {
			this.handling = false;
		}
	};
	constructor(
		private readonly events: IEventBus,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
	) {}
	initialize(): void {
		if (this.previous) return;
		this.previous = geterrorhandler();
		seterrorhandler(this.handleError);
	}
	shutdown(): void {
		this.cancelOpen?.();
		this.cancelOpen = undefined;
		if (this.previous && geterrorhandler() === this.handleError)
			seterrorhandler(this.previous);
		this.previous = undefined;
	}
}
