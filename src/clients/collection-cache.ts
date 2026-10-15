import { type CacheEntries, SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";

export interface ICollectionCache {
	create<T>(namespace: string, character?: boolean): SavedVariableCache<T>;
}
export interface CacheStats {
	readonly namespace: string;
	readonly entries: number;
	readonly pending: number;
	readonly updatedAt?: number;
}
export class CollectionCache implements ICollectionCache {
	private readonly stores = new Map<string, SavedVariableCache<unknown>>();
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly character: () => string = () =>
			String(
				(UnitGUID as unknown as (this: void, unit: string) => string)("player"),
			),
		private readonly clock: () => number = () => 0,
	) {}
	stats(): CacheStats[] {
		return [...this.stores].map(([namespace, cache]) => ({
			namespace,
			...cache.stats(),
			updatedAt:
				SteamDeckUIConfig?.collectionCache?.updatedAt?.[
					this.savedKey(namespace)
				],
		}));
	}
	private savedKey(namespace: string): string {
		return namespace.endsWith(":character")
			? `${namespace.slice(0, -10)}:${this.character()}`
			: namespace;
	}
	create<T>(namespace: string, character = false): SavedVariableCache<T> {
		const existing = this.stores.get(
			namespace + (character ? ":character" : ""),
		);
		if (existing) return existing as SavedVariableCache<T>;
		const cache = new SavedVariableCache<T>(() => {
			// Construction precedes login, so resolve the table only on access.
			SteamDeckUIConfig ??= {};
			SteamDeckUIConfig.collectionCache ??= { version: 2, namespaces: {} };
			const saved = SteamDeckUIConfig.collectionCache;
			if (saved.version === 1) {
				// Schema 1 duplicated journal data in snapshot namespaces. Keep each
				// authoritative item record and retire only those obsolete containers.
				for (const legacy of Object.keys(saved.namespaces))
					if (legacy.endsWith(".snapshot")) delete saved.namespaces[legacy];
				saved.version = 2;
			}
			const key = character ? `${namespace}:${this.character()}` : namespace;
			const namespaces = SteamDeckUIConfig.collectionCache.namespaces;
			namespaces[key] ??= {};
			return namespaces[key] as CacheEntries<T>;
		}, this.scheduler);
		this.stores.set(
			namespace + (character ? ":character" : ""),
			cache as SavedVariableCache<unknown>,
		);
		cache.subscribe(() => {
			const saved = SteamDeckUIConfig?.collectionCache;
			if (!saved) return;
			saved.updatedAt ??= {};
			saved.updatedAt[
				character ? `${namespace}:${this.character()}` : namespace
			] = this.clock();
		});
		return cache;
	}
}
