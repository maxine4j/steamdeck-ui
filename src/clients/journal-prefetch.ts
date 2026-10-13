import type { ITaskScheduler } from "./task-scheduler";
import type { TieredCache } from "./tiered-cache";

export interface IJournalPrefetch {
	prefetch(): void;
	invalidate(id?: number): void;
	stop(): void;
}

interface Observer<T, P> {
	// Stored callbacks must retain the scan's plain Lua calling convention.
	done(this: void, value: T): void;
	preview?: (this: void, value: P) => void;
	progress?: (this: void, completed: number, total: number) => void;
}

/** Retains data only; the underlying client still bounds native work per frame. */
export class JournalPrefetch<T, P = T> implements IJournalPrefetch {
	private active = false;
	private dirty = true;
	private revision = 0;
	private generation = 0;
	private value?: T;
	private cancel?: () => void;
	private readonly observers = new Set<Observer<T, P>>();
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly scan: (
			done: (value: T) => void,
			preview?: (value: P) => void,
			progress?: (completed: number, total: number) => void,
		) => () => void,
		private readonly persisted?: TieredCache<T>,
	) {}
	prefetch(): void {
		this.active = true;
		if (!this.dirty) return;
		this.start();
	}
	invalidate(): void {
		this.dirty = true;
		this.revision++;
		if (this.active) this.start();
	}
	load(
		done: (value: T) => void,
		preview?: (value: P) => void,
		progress?: (completed: number, total: number) => void,
	): () => void {
		this.active = true;
		if (this.persisted) {
			const value = this.persisted.peek("snapshot");
			if (!this.dirty && value !== undefined) {
				done(value);
				return () => {};
			}
			// Keep the complete cached view interactive until replacement is ready.
			const observer = {
				done,
				preview: value === undefined ? preview : undefined,
				progress,
			};
			this.observers.add(observer);
			if (value !== undefined) done(value);
			this.start();
			return () => {
				this.observers.delete(observer);
			};
		}
		if (!this.dirty && this.value !== undefined) {
			const value = this.value;
			const revision = this.revision;
			const generation = this.generation;
			let cancel = this.scheduler.nextFrame(() => {
				if (generation !== this.generation) return;
				if (revision === this.revision) done(value);
				else cancel = this.load(done, preview, progress);
			});
			return () => cancel();
		}
		const observer = { done, preview, progress };
		this.observers.add(observer);
		this.start();
		return () => {
			// Closing a panel detaches its callbacks; journal work fills the cache.
			this.observers.delete(observer);
		};
	}
	private start(): void {
		if (!this.dirty || this.cancel) return;
		const revision = this.revision;
		const generation = this.generation;
		this.cancel = this.scan(
			(value) => {
				if (generation !== this.generation) return;
				this.cancel = undefined;
				if (revision !== this.revision) {
					this.start();
					return;
				}
				this.value = value;
				this.persisted?.put("snapshot", value);
				this.dirty = false;
				const observers = [...this.observers];
				this.observers.clear();
				for (const observer of observers) observer.done(value);
			},
			(value) => {
				if (generation !== this.generation || revision !== this.revision)
					return;
				for (const observer of this.observers) observer.preview?.(value);
			},
			(completed, total) => {
				if (generation !== this.generation) return;
				for (const observer of this.observers)
					observer.progress?.(completed, total);
			},
		);
	}
	stop(): void {
		this.generation++;
		this.active = false;
		this.invalidate();
		this.cancel?.();
		this.cancel = undefined;
		this.value = undefined;
		this.observers.clear();
	}
}
