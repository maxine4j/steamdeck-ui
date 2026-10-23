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
	private handling = false;
	private allowance = 10;
	private lastErrorAt?: number;
	private autoOpenRequested = false;
	private cancelOpen?: () => void;
	private readonly handleError: (this: void, message: unknown) => void = (
		message,
	) => {
		if (this.handling) return;
		this.handling = true;
		try {
			// Bound stack generation, diagnostics and Blizzard's previous handler.
			// A 100-record storage cap alone does not bound work during a flood.
			const now = GetTime();
			this.allowance = Math.min(
				10,
				this.allowance + Math.max(0, now - (this.lastErrorAt ?? now)) * 10,
			);
			this.lastErrorAt = now;
			if (this.allowance < 1) {
				this.errors.suppress(GetServerTime());
				return;
			}
			this.allowance--;
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
			if (!this.autoOpenRequested) {
				// Keep this latched after dispatch, including when opening the UI
				// itself raises errors. Later frames must not reopen that same UI.
				this.autoOpenRequested = true;
				this.cancelOpen = this.scheduler.nextFrame(() => {
					this.cancelOpen = undefined;
					this.events.emit("DEBUG_OPEN_REQUESTED");
				});
			}
			this.previous?.(message);
		} finally {
			this.handling = false;
		}
	};
	constructor(
		private readonly events: IEventBus,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
		private readonly captureErrors = true,
	) {}
	loadErrors(): LuaErrorSnapshot {
		return this.errors.load(GetServerTime());
	}
	initialize(): void {
		if (!this.captureErrors || this.previous) return;
		this.allowance = 10;
		this.lastErrorAt = undefined;
		this.autoOpenRequested = false;
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
