import type { ErrorEnvironment } from "./error-context-client";

export interface LuaErrorRecord {
	readonly id: number;
	readonly timestamp: number;
	readonly message: string;
	readonly stack: string;
	readonly context?: string;
	readonly environment?: ErrorEnvironment;
}

export interface LuaErrorSnapshot {
	readonly errors: readonly LuaErrorRecord[];
	readonly isNew: (error: LuaErrorRecord) => boolean;
	readonly suppressedCount?: number;
}

declare global {
	var SteamDeckUIErrors:
		| {
				version: 1;
				errors: LuaErrorRecord[];
				lastViewedAt?: number;
				lastViewedId?: number;
				suppressedCount?: number;
				lastSuppressedAt?: number;
		  }
		| undefined;
}

/** Resolve the loaded SavedVariables table lazily; retain each occurrence. */
export class LuaErrorHistory {
	private saved() {
		SteamDeckUIErrors ??= { version: 1, errors: [] };
		const saved = SteamDeckUIErrors;
		if (saved.errors.length > 100)
			saved.errors.splice(0, saved.errors.length - 100);
		return saved;
	}
	capture(
		message: string,
		stack: string,
		timestamp: number,
		context?: string,
		environment?: ErrorEnvironment,
	): void {
		const saved = this.saved();
		const id = (saved.errors.at(-1)?.id ?? 0) + 1;
		saved.errors.push({ id, timestamp, message, stack, context, environment });
		if (saved.errors.length > 100) saved.errors.shift();
	}
	suppress(timestamp: number): void {
		const saved = this.saved();
		saved.suppressedCount = (saved.suppressedCount ?? 0) + 1;
		saved.lastSuppressedAt = timestamp;
	}
	load(timestamp: number): LuaErrorSnapshot {
		const saved = this.saved();
		const viewedAt = saved.lastViewedAt;
		const viewedId = saved.lastViewedId ?? 0;
		const errors = [...saved.errors];
		saved.lastViewedAt = timestamp;
		saved.lastViewedId = errors.at(-1)?.id ?? viewedId;
		return {
			errors,
			suppressedCount: saved.suppressedCount ?? 0,
			// Sequence breaks ties when multiple errors occur in one server second.
			isNew: (error) =>
				viewedAt === undefined ||
				error.timestamp > viewedAt ||
				(error.timestamp === viewedAt && error.id > viewedId),
		};
	}
}
