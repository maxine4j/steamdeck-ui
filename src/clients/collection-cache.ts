import type { ITaskScheduler } from "./task-scheduler";
import { type CacheEntries, TieredCache } from "./tiered-cache";

export interface ICollectionCache {
	create<T>(
		namespace: string,
		character?: boolean,
		ttl?: number,
	): TieredCache<T>;
}
export class CollectionCache implements ICollectionCache {
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly now: () => number = () => GetServerTime(),
		private readonly character: () => string = () =>
			String(
				(UnitGUID as unknown as (this: void, unit: string) => string)("player"),
			),
	) {}
	create<T>(namespace: string, character = false, ttl = 86400): TieredCache<T> {
		// Resolve SavedVariables lazily: construction precedes PLAYER_LOGIN.
		return new TieredCache<T>(
			() => {
				SteamDeckUIConfig ??= {};
				if (SteamDeckUIConfig.collectionCache?.version !== 1)
					SteamDeckUIConfig.collectionCache = { version: 1, namespaces: {} };
				const key = character ? `${namespace}:${this.character()}` : namespace;
				const namespaces = SteamDeckUIConfig.collectionCache.namespaces;
				namespaces[key] ??= {};
				return namespaces[key] as CacheEntries<T>;
			},
			this.now,
			ttl,
			this.scheduler,
		);
	}
}
