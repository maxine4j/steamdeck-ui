import {
	type IPerformanceClient,
	quietPerformance,
	WorkMeasurement,
} from "./performance-client";
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
export type CollectionUpdate<T> = (
	this: void,
	rows: readonly T[],
	complete: boolean,
) => void;
interface CollectionJournalOptions {
	readonly pageSize: number;
	readonly label: string;
	readonly performance: IPerformanceClient;
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
	private scanMeasurement?: WorkMeasurement;
	private targetMeasurement?: WorkMeasurement;
	private targetCount = 0;
	private projectionMeasurement?: WorkMeasurement;
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
		private readonly options: CollectionJournalOptions = {
			pageSize: 20,
			label: "collection",
			performance: quietPerformance,
		},
	) {}
	isScanning(): boolean {
		return this.cancelScan !== undefined;
	}
	prefetch(reason = "login"): void {
		this.start(reason);
	}
	refreshEntry(key?: string): void {
		if (key === undefined) {
			if (this.cancelScan) {
				if (this.started && !this.repeat) {
					this.repeat = true;
					this.options.performance.log(
						`${this.options.label} scan repeat queued reason=server-event`,
					);
				}
			} else this.start("server-event");
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
	private start(reason: string): void {
		if (this.cancelScan) return;
		const generation = this.generation;
		this.started = false;
		const measurement = new WorkMeasurement(
			this.options.performance,
			`${this.options.label} scan`,
			reason,
		);
		this.scanMeasurement = measurement;
		let reader: CollectionPageReader<T> | undefined;
		let index = 0;
		const step = () => {
			if (generation !== this.generation) return;
			this.started = true;
			const started = this.options.performance.now();
			const rows = measurement.measure("journal", () => {
				reader ??= this.begin();
				const end = Math.min(reader.count, index + this.options.pageSize);
				const rows: T[] = [];
				while (index < end) rows.push(...reader.read(index++));
				return rows;
			});
			measurement.measure("publish", () => this.write(rows));
			measurement.page(started);
			const page = reader;
			if (!page) return;
			if (generation !== this.generation) return;
			for (const observer of [...this.progress]) observer(index, page.count);
			if (index < page.count) this.cancelScan = this.scheduler.nextFrame(step);
			else {
				this.cancelScan = undefined;
				this.started = false;
				measurement.finish(`complete entries=${index}`);
				this.scanMeasurement = undefined;
				page.finish?.();
				if (this.repeat) {
					this.repeat = false;
					this.start("server-event-repeat");
				}
				this.notify();
			}
		};
		this.cancelScan = this.scheduler.nextFrame(step);
	}
	private scheduleTargets(): void {
		if (this.cancelTargets) return;
		this.targetMeasurement ??= new WorkMeasurement(
			this.options.performance,
			`${this.options.label} targets`,
			"server-event",
		);
		const measurement = this.targetMeasurement;
		const generation = this.generation;
		this.cancelTargets = this.scheduler.nextFrame(() => {
			if (generation !== this.generation) return;
			this.cancelTargets = undefined;
			const started = this.options.performance.now();
			let journalTime = 0;
			this.cache.batch(() => {
				let remaining = this.options.pageSize;
				for (const key of this.targets) {
					this.targets.delete(key);
					this.targetCount++;
					const readStart = this.options.performance.now();
					const rows = this.readTarget(key);
					journalTime += this.options.performance.now() - readStart;
					// Subsequent sibling updates must see preceding writes in SavedVariables.
					this.write(rows);
					if (--remaining === 0) break;
				}
			});
			measurement.add("journal", journalTime);
			measurement.add(
				"publish",
				this.options.performance.now() - started - journalTime,
			);
			measurement.page(started);
			if (generation === this.generation && this.targets.size > 0)
				this.scheduleTargets();
			else if (generation === this.generation) {
				measurement.finish(`complete entries=${this.targetCount}`);
				this.targetMeasurement = undefined;
				this.targetCount = 0;
			}
		});
	}
	project(begin: () => CollectionPageReader<T>): void {
		this.projectionMeasurement?.finish("superseded");
		const measurement = new WorkMeasurement(
			this.options.performance,
			`${this.options.label} projection`,
			"filter-or-display",
		);
		this.projectionMeasurement = measurement;
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
			const started = this.options.performance.now();
			const rows = measurement.measure("journal", () => {
				reader ??= begin();
				const end = Math.min(reader.count, index + this.options.pageSize);
				const rows: T[] = [];
				while (index < end) rows.push(...reader.read(index++));
				return rows;
			});
			measurement.measure("publish", () => this.write(rows));
			measurement.page(started);
			const page = reader;
			if (!page) return;
			if (
				generation !== this.generation ||
				revision !== this.projectionGeneration
			)
				return;
			if (index < page.count)
				this.cancelProjection = this.scheduler.nextFrame(step);
			else {
				this.cancelProjection = undefined;
				measurement.finish(`complete entries=${index}`);
				this.projectionMeasurement = undefined;
				page.finish?.();
				this.notify();
			}
		};
		this.cancelProjection = this.scheduler.nextFrame(step);
	}
	load(
		done: (rows: T[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<T>,
	): () => void {
		const complete = () => !this.cancelScan && !this.cancelProjection;
		const publish = () =>
			changed
				? changed([], complete())
				: done(
						this.cache.values().filter((row) => this.included(row)),
						complete(),
					);
		const detach = this.cache.subscribe((changes) => {
			if (changed)
				changed(
					changes.map((change) => change.value),
					complete(),
				);
			else publish();
		});
		this.subscriptions.add(detach);
		this.observers.add(publish);
		const progressObserver = progress
			? (completed: number, total: number) => progress(completed, total)
			: undefined;
		if (progressObserver) this.progress.add(progressObserver);
		const cached = this.cache.values();
		this.options.performance.log(
			`${this.options.label} open cached=${cached.length} scanning=${this.isScanning()}`,
		);
		if (cached.length > 0)
			done(
				cached.filter((row) => this.included(row)),
				complete(),
			);
		else this.start("empty-cache");
		return () => {
			detach();
			this.subscriptions.delete(detach);
			this.observers.delete(publish);
			if (progressObserver) this.progress.delete(progressObserver);
		};
	}
	stop(): void {
		this.scanMeasurement?.finish("cancelled");
		this.scanMeasurement = undefined;
		this.targetMeasurement?.finish("cancelled");
		this.targetMeasurement = undefined;
		this.targetCount = 0;
		this.projectionMeasurement?.finish("cancelled");
		this.projectionMeasurement = undefined;
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
