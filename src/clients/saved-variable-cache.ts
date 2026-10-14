import type { ITaskScheduler } from "./task-scheduler";

export interface CacheEntry<T> {
	value: T;
}
export type CacheEntries<T> = Record<string, CacheEntry<T> | undefined>;
export interface CacheChange<T> {
	readonly key: string;
	readonly value: T;
}

/** WoW already loads SavedVariables into memory. Never duplicate their data. */
export class SavedVariableCache<T> {
	private readonly observers = new Set<
		(this: void, changes: readonly CacheChange<T>[]) => void
	>();
	private readonly pending = new Map<string, (this: void) => T>();
	private cancel?: () => void;
	private generation = 0;
	constructor(
		private readonly saved: () => CacheEntries<T>,
		private readonly scheduler: ITaskScheduler,
	) {}
	peek(key: string): T | undefined {
		const entries = this.saved();
		const entry = entries[key];
		// Preserve values from the previous schema, dropping obsolete metadata.
		if (entry && "expiresAt" in entry) entries[key] = { value: entry.value };
		return entry?.value;
	}
	values(): T[] {
		const values: T[] = [];
		for (const key of Object.keys(this.saved())) {
			const value = this.peek(key);
			if (value !== undefined) values.push(value);
		}
		return values;
	}
	put(key: string, value: T): void {
		this.putMany([{ key, value }]);
	}
	putMany(changes: readonly CacheChange<T>[]): void {
		const entries = this.saved();
		for (const change of changes) entries[change.key] = { value: change.value };
		if (changes.length > 0)
			for (const observer of [...this.observers]) observer(changes);
	}
	subscribe(
		observer: (changes: readonly CacheChange<T>[]) => void,
	): () => void {
		this.observers.add(observer);
		return () => {
			this.observers.delete(observer);
		};
	}
	get(key: string, read: () => T): T {
		const value = this.peek(key);
		if (value !== undefined) {
			this.refresh(key, read);
			return value;
		}
		const loaded = read();
		this.put(key, loaded);
		return loaded;
	}
	refresh(key: string, read: () => T): void {
		if (this.pending.has(key)) return;
		this.pending.set(key, read);
		this.schedule();
	}
	private schedule(): void {
		if (this.cancel) return;
		const generation = this.generation;
		this.cancel = this.scheduler.nextFrame(() => {
			if (generation !== this.generation) return;
			this.cancel = undefined;
			const changes: CacheChange<T>[] = [];
			for (const [key, read] of this.pending) {
				this.pending.delete(key);
				changes.push({ key, value: read() });
				if (changes.length === 20) break;
			}
			this.putMany(changes);
			if (this.pending.size > 0) this.schedule();
		});
	}
	stop(): void {
		this.generation++;
		this.cancel?.();
		this.cancel = undefined;
		this.pending.clear();
	}
}
