import type { ITaskScheduler } from "./task-scheduler";

export interface IJournalPrefetch {
	prefetch(): void;
	invalidate(): void;
	stop(): void;
}

interface Observer<T, P> {
	done(value: T): void;
	preview?: (value: P) => void;
	progress?: (completed: number, total: number) => void;
}

/** Retains data only; the underlying client still bounds native work per frame. */
export class JournalPrefetch<T, P = T> implements IJournalPrefetch {
	private enabled = false;
	private warming = false;
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
	) {}
	prefetch(): void {
		this.enabled = true;
		if (!this.dirty) return;
		this.warming = true;
		this.start();
	}
	invalidate(): void {
		this.dirty = true;
		this.revision++;
	}
	load(
		done: (value: T) => void,
		preview?: (value: P) => void,
		progress?: (completed: number, total: number) => void,
	): () => void {
		if (!this.enabled) return this.scan(done, preview, progress);
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
			this.observers.delete(observer);
		};
	}
	private start(): void {
		if (this.cancel) return;
		const revision = this.revision;
		const generation = this.generation;
		this.cancel = this.scan(
			(value) => {
				if (generation !== this.generation) return;
				this.cancel = undefined;
				if (revision !== this.revision) {
					if (this.warming || this.observers.size > 0) this.start();
					return;
				}
				this.value = value;
				this.dirty = false;
				this.warming = false;
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
		this.enabled = false;
		this.warming = false;
		this.invalidate();
		this.cancel?.();
		this.cancel = undefined;
		this.value = undefined;
		this.observers.clear();
	}
}
