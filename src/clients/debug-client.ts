import type { IEventBus } from "../events/types";
import { Diagnostics } from "./diagnostics";
import { LuaErrorHistory, type LuaErrorSnapshot } from "./lua-error-history";
import type { ITaskScheduler } from "./task-scheduler";

// Lua runtime globals are not part of the generated WoW API surface.
declare global {
	function geterrorhandler(this: void): (this: void, message: unknown) => void;
	function seterrorhandler(
		this: void,
		handler: (this: void, message: unknown) => void,
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
	private readonly errors = new LuaErrorHistory();
	private previous?: (this: void, message: unknown) => void;
	private cancelOpen?: () => void;
	private handling = false;
	private opening = false;
	private readonly handleError: (this: void, message: unknown) => void = (
		message,
	) => {
		if (this.handling) return;
		this.handling = true;
		try {
			// Retail exposes the original failure's stack height even while this
			// handler is executing through TSTL's pcall wrapper.
			const currentHeight = GetCallstackHeight();
			const errorHeight = GetErrorCallstackHeight();
			const rawStack = debugstack(
				errorHeight ? currentHeight - (errorHeight - 1) : 2,
				100,
				100,
			);
			// The generated API declaration only accepts numbers; Retail accepts
			// arbitrary values. Never concatenate or persist secret strings.
			const secret = issecretvalue as unknown as (
				this: void,
				value: unknown,
			) => boolean;
			const safeMessage = secret(message)
				? "Lua error message unavailable (secret value)"
				: String(message);
			const stack = secret(rawStack)
				? "Stack trace unavailable (secret value)"
				: (rawStack ?? "Stack trace unavailable");
			this.errors.capture(safeMessage, stack, GetServerTime());
			this.diagnostics.log("error", `${safeMessage}\n${stack}`);
			if (!this.cancelOpen && !this.opening)
				this.cancelOpen = this.scheduler.nextFrame(() => {
					this.cancelOpen = undefined;
					// Capture UI failures, but do not recursively reopen the broken UI.
					this.opening = true;
					try {
						this.events.emit("DEBUG_OPEN_REQUESTED");
					} finally {
						this.opening = false;
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
	loadErrors(): LuaErrorSnapshot {
		return this.errors.load(GetServerTime());
	}
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
