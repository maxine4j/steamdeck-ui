import { BUILD_COMMIT } from "../build-info";
import type { IEventBus } from "../events/types";
import { Diagnostics } from "./diagnostics";
import type { ErrorEnvironment } from "./error-context-client";
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

/** TSTL emits pcall; failures in diagnostics must never be reported recursively. */
function attempt<T>(read: () => T): T | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}

export class DebugClient {
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
		let forward = true;
		try {
			// Bound stack generation, diagnostics and Blizzard's previous handler.
			// A 100-record storage cap alone does not bound work during a flood.
			const now = attempt(() => GetTime()) ?? this.lastErrorAt ?? 0;
			this.allowance = Math.min(
				10,
				this.allowance + Math.max(0, now - (this.lastErrorAt ?? now)) * 10,
			);
			this.lastErrorAt = now;
			if (this.allowance < 1) {
				forward = false;
				this.errors.suppress(GetServerTime());
				return;
			}
			this.allowance--;
			// The generated API declaration only accepts numbers; Retail accepts
			// arbitrary values. Never concatenate or persist secret strings.
			const secret = issecretvalue as unknown as (
				this: void,
				value: unknown,
			) => boolean;
			const safeMessage =
				attempt(() =>
					secret(message)
						? "Lua error message unavailable (secret value)"
						: String(message),
				) ?? "Lua error message unavailable";
			const stack =
				attempt(() => {
					// Measure and read the stack inside the same pcall callback so
					// its extra stack frames are included in Retail's error offset.
					const currentHeight = GetCallstackHeight();
					const errorHeight = GetErrorCallstackHeight();
					const rawStack = debugstack(
						errorHeight ? currentHeight - (errorHeight - 1) : 2,
						100,
						100,
					);
					return secret(rawStack)
						? "Stack trace unavailable (secret value)"
						: rawStack;
				}) ?? "Stack trace unavailable";
			const timestamp = attempt(() => GetServerTime()) ?? 0;
			const context = attempt(() => this.diagnostics.report().slice(-12000));
			const environment = attempt(() => this.context?.capture()) ?? {
				buildCommit: BUILD_COMMIT,
				details: {},
				unavailableFields: ["environment"],
			};
			attempt(() =>
				this.errors.capture(
					safeMessage,
					stack,
					timestamp,
					context,
					environment,
				),
			);
			attempt(() => this.diagnostics.log("error", `${safeMessage}\n${stack}`));
			if (!this.autoOpenRequested) {
				// Keep this latched after dispatch, including when opening the UI
				// itself raises errors. Later frames must not reopen that same UI.
				this.autoOpenRequested = true;
				this.cancelOpen = attempt(() =>
					this.scheduler.nextFrame(() => {
						this.cancelOpen = undefined;
						attempt(() => this.events.emit("DEBUG_OPEN_REQUESTED"));
					}),
				);
			}
		} catch {
			// Last-resort boundary for the capture pipeline itself. Do not log
			// this failure through the same diagnostics/error handler.
		} finally {
			if (forward) attempt(() => this.previous?.(message));
			this.handling = false;
		}
	};
	constructor(
		private readonly events: IEventBus,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
		private readonly captureErrors = true,
		readonly diagnostics = new Diagnostics(() => GetServerTime()),
		private readonly context?: { capture(): ErrorEnvironment },
	) {}
	loadErrors(): LuaErrorSnapshot {
		return (
			attempt(() => this.errors.load(GetServerTime())) ?? {
				errors: [],
				isNew: () => false,
			}
		);
	}
	clearAll(): void {
		SteamDeckUIErrors = { version: 1, errors: [] };
		SteamDeckUILogs = { version: 1, entries: [], droppedCount: 0 };
		this.allowance = 10;
		this.lastErrorAt = undefined;
		this.cancelOpen?.();
		this.cancelOpen = undefined;
		this.autoOpenRequested = false;
		this.diagnostics.clear();
	}
	initialize(): void {
		if (!this.captureErrors || this.previous) return;
		this.allowance = 10;
		this.lastErrorAt = undefined;
		this.autoOpenRequested = false;
		attempt(() => {
			const previous = geterrorhandler();
			seterrorhandler(this.handleError);
			this.previous = previous;
		});
		if (this.previous)
			attempt(() => this.diagnostics.log("info", "session started"));
	}
	shutdown(): void {
		if (this.previous)
			attempt(() => this.diagnostics.log("info", "session stopped"));
		const cancel = this.cancelOpen;
		this.cancelOpen = undefined;
		attempt(() => cancel?.());
		const released = attempt(() => {
			if (this.previous && geterrorhandler() === this.handleError)
				seterrorhandler(this.previous);
			return true;
		});
		if (released) this.previous = undefined;
	}
}
