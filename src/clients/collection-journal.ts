import type { SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";

export interface CollectionPageReader<T> {
	readonly count: number;
	read(this: void, index: number): readonly T[];
	finish?(this: void): void;
}
export interface ICollectionJournal<ID> {
	prefetch(): void;
	refreshEntry(id?: ID): void;
	stop(): void;
}

/** Scheduling and observation only; clients provide every domain/API operation. */
export class CollectionJournal<T> {
	private cancelScan?: () => void;
	private started = false;
	private repeat = false;
	private cancelTargets?: () => void;
	private readonly targets = new Set<string>();
	private cancelProjection?: () => void;
	private projectionGeneration = 0;
	private generation = 0;
	private readonly observers = new Set<(this: void) => void>();
	private readonly subscriptions = new Set<() => void>();
	private readonly progress = new Set<
		(this: void, completed: number, total: number) => void
	>();
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly cache: SavedVariableCache<T>,
		private readonly key: (this: void, row: T) => string,
		private readonly included: (this: void, row: T) => boolean,
		private readonly begin: (this: void) => CollectionPageReader<T>,
		private readonly readTarget: (this: void, key: string) => readonly T[],
	) {}
	isScanning(): boolean {
		return this.cancelScan !== undefined;
	}
	prefetch(): void {
		this.start();
	}
	refreshEntry(key?: string): void {
		if (key === undefined) {
			if (this.cancelScan) this.repeat ||= this.started;
			else this.start();
		} else {
			this.targets.add(key);
			this.scheduleTargets();
		}
	}
	private write(rows: readonly T[]): void {
		this.cache.putMany(rows.map((value) => ({ key: this.key(value), value })));
	}
	private notify(): void {
		for (const observer of [...this.observers]) observer();
	}
	private start(): void {
		if (this.cancelScan) return;
		const generation = this.generation;
		this.started = false;
		let reader: CollectionPageReader<T> | undefined;
		let index = 0;
		const step = () => {
			if (generation !== this.generation) return;
			this.started = true;
			reader ??= this.begin();
			const end = Math.min(reader.count, index + 20);
			const page = reader;
			this.cache.batch(() => {
				while (index < end) this.write(page.read(index++));
			});
			if (generation !== this.generation) return;
			for (const observer of [...this.progress]) observer(index, reader.count);
			if (index < reader.count)
				this.cancelScan = this.scheduler.nextFrame(step);
			else {
				this.cancelScan = undefined;
				this.started = false;
				reader.finish?.();
				if (this.repeat) {
					this.repeat = false;
					this.start();
				}
				this.notify();
			}
		};
		this.cancelScan = this.scheduler.nextFrame(step);
	}
	private scheduleTargets(): void {
		if (this.cancelTargets) return;
		const generation = this.generation;
		this.cancelTargets = this.scheduler.nextFrame(() => {
			if (generation !== this.generation) return;
			this.cancelTargets = undefined;
			let remaining = 20;
			this.cache.batch(() => {
				for (const key of this.targets) {
					this.targets.delete(key);
					this.write(this.readTarget(key));
					if (--remaining === 0) break;
				}
			});
			if (generation === this.generation && this.targets.size > 0)
				this.scheduleTargets();
		});
	}
	project(begin: () => CollectionPageReader<T>): void {
		this.cancelProjection?.();
		const revision = ++this.projectionGeneration;
		const generation = this.generation;
		let reader: CollectionPageReader<T> | undefined;
		let index = 0;
		const step = () => {
			if (
				generation !== this.generation ||
				revision !== this.projectionGeneration
			)
				return;
			reader ??= begin();
			const end = Math.min(reader.count, index + 20);
			const page = reader;
			this.cache.batch(() => {
				while (index < end) this.write(page.read(index++));
			});
			if (
				generation !== this.generation ||
				revision !== this.projectionGeneration
			)
				return;
			if (index < reader.count)
				this.cancelProjection = this.scheduler.nextFrame(step);
			else {
				this.cancelProjection = undefined;
				reader.finish?.();
				this.notify();
			}
		};
		this.cancelProjection = this.scheduler.nextFrame(step);
	}
	load(
		done: (rows: T[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
	): () => void {
		const publish = () =>
			done(
				this.cache.values().filter((row) => this.included(row)),
				!this.cancelScan && !this.cancelProjection,
			);
		const detach = this.cache.subscribe(publish);
		this.subscriptions.add(detach);
		this.observers.add(publish);
		const progressObserver = progress
			? (completed: number, total: number) => progress(completed, total)
			: undefined;
		if (progressObserver) this.progress.add(progressObserver);
		if (this.cache.values().length > 0) publish();
		else this.start();
		return () => {
			detach();
			this.subscriptions.delete(detach);
			this.observers.delete(publish);
			if (progressObserver) this.progress.delete(progressObserver);
		};
	}
	stop(): void {
		this.generation++;
		this.cancelScan?.();
		this.cancelScan = undefined;
		this.cancelTargets?.();
		this.cancelTargets = undefined;
		this.cancelProjection?.();
		this.cancelProjection = undefined;
		this.started = false;
		this.repeat = false;
		this.targets.clear();
		for (const detach of this.subscriptions) detach();
		this.subscriptions.clear();
		this.observers.clear();
		this.progress.clear();
	}
}
