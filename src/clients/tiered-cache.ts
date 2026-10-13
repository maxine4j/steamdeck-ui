import type { ITaskScheduler } from "./task-scheduler";

export interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}
export type CacheEntries<T> = Record<string, CacheEntry<T> | undefined>;
/** Stale-while-revalidate: expiry marks freshness, never removes the last usable value. */
export class TieredCache<T> {
	private readonly memory = new Map<string, CacheEntry<T>>();
	private readonly pending = new Map<string, (this: void) => T>();
	private cancel?: () => void;
	private generation = 0;
	constructor(
		private readonly saved: () => CacheEntries<T>,
		private readonly now: () => number,
		private readonly ttl: number,
		private readonly scheduler: ITaskScheduler,
	) {}
	peek(key: string): T | undefined {
		let entry = this.memory.get(key);
		if (!entry) {
			entry = this.saved()[key];
			if (entry) this.memory.set(key, entry);
		}
		return entry?.value;
	}
	put(key: string, value: T): void {
		const entry = { value, expiresAt: this.now() + this.ttl };
		this.memory.set(key, entry);
		this.saved()[key] = entry;
	}
	isExpired(key: string): boolean {
		this.peek(key);
		return (this.memory.get(key)?.expiresAt ?? 0) <= this.now();
	}
	get(key: string, read: () => T): T {
		// Explicit lookups refresh even fresh entries; TTLs govern broad invalidations.
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
			let remaining = 20;
			for (const [key, read] of this.pending) {
				this.pending.delete(key);
				this.put(key, read());
				if (--remaining === 0) break;
			}
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
