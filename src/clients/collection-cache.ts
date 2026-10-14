import { type CacheEntries, SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";

export interface ICollectionCache {
	create<T>(namespace: string, character?: boolean): SavedVariableCache<T>;
}
export class CollectionCache implements ICollectionCache {
	private readonly stores = new Map<string, SavedVariableCache<unknown>>();
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly character: () => string = () =>
			String(
				(UnitGUID as unknown as (this: void, unit: string) => string)("player"),
			),
	) {}
	create<T>(namespace: string, character = false): SavedVariableCache<T> {
		const existing = this.stores.get(
			namespace + (character ? ":character" : ""),
		);
		if (existing) return existing as SavedVariableCache<T>;
		const cache = new SavedVariableCache<T>(() => {
			// Construction precedes login, so resolve the table only on access.
			SteamDeckUIConfig ??= {};
			SteamDeckUIConfig.collectionCache ??= { version: 1, namespaces: {} };
			const key = character ? `${namespace}:${this.character()}` : namespace;
			const namespaces = SteamDeckUIConfig.collectionCache.namespaces;
			namespaces[key] ??= {};
			return namespaces[key] as CacheEntries<T>;
		}, this.scheduler);
		this.stores.set(
			namespace + (character ? ":character" : ""),
			cache as SavedVariableCache<unknown>,
		);
		return cache;
	}
}
