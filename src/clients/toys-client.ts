import type { ICollectionCache } from "./collection-cache";
import type { CollectionFilter, ICollectionQuery } from "./collection-query";
import { type IJournalPrefetch, JournalPrefetch } from "./journal-prefetch";
import type { ITaskScheduler } from "./task-scheduler";
import type { TieredCache } from "./tiered-cache";

// Legacy toy APIs are absent from the generated Retail declarations.
declare global {
	namespace C_ToyBox {
		function SetFilterString(this: void, text: string): void;
		function GetNumFilteredToys(this: void): number;
		function GetToyFromIndex(this: void, index: number): number;
		function GetToyInfo(
			this: void,
			id: number,
		): LuaMultiReturn<
			[number | undefined, string | undefined, number, boolean]
		>;
		function GetIsFavorite(this: void, id: number): boolean;
		function SetIsFavorite(this: void, id: number, favourite: boolean): void;
		function IsToyUsable(this: void, id: number): boolean;
	}
	function PlayerHasToy(this: void, id: number): boolean;
}

export interface Toy {
	readonly id: number;
	readonly name: string;
	readonly icon: number;
	readonly collected: boolean;
	readonly favourite: boolean;
	readonly expansionId?: number;
}
export interface IToysClient extends IJournalPrefetch, ICollectionQuery {
	invalidateItem?(id: number): boolean;
	isInCombat(): boolean;
	load(
		callback: (toys: Toy[]) => void,
		onProgress?: (completed: number, total: number) => void,
		onFirstPage?: (toys: Toy[]) => void,
		retainCachedView?: boolean,
	): () => void;
	toggleFavourite(id: number): void;
	canUse(id: number): boolean;
	getCooldown(id: number): { start: number; duration: number };
}

// Legacy filter APIs are not included in the generated documentation surface.
interface ToyFilterApi {
	GetCollectedShown(this: void): boolean;
	GetUncollectedShown(this: void): boolean;
	GetUnusableShown(this: void): boolean;
	SetCollectedShown(this: void, checked: boolean): void;
	SetUncollectedShown(this: void, checked: boolean): void;
	SetUnusableShown(this: void, checked: boolean): void;
	IsSourceTypeFilterChecked(this: void, index: number): boolean;
	SetSourceTypeFilter(this: void, index: number, checked: boolean): void;
	IsExpansionTypeFilterChecked(this: void, index: number): boolean;
	SetExpansionTypeFilter(this: void, index: number, checked: boolean): void;
}

export class ToysClient implements IToysClient {
	private filtersInitialized = false;
	private readonly requestedItems = new Set<number>();
	private journal: JournalPrefetch<Toy[]>;
	private querying = false;
	private querySnapshot?: Toy[];
	private readonly items?: TieredCache<Toy>;
	private readonly snapshots?: TieredCache<Toy[]>;
	private backfill = false;
	private expiredOnly = false;
	private readonly dirtyIds = new Set<number>();
	constructor(
		private readonly scheduler: ITaskScheduler,
		cache?: ICollectionCache,
	) {
		this.items = cache?.create("toys.items", false, 3600);
		this.snapshots = cache?.create("toys.snapshot", false, 3600);
		this.journal = this.createJournal(this.snapshots);
	}
	private createJournal(
		persisted?: TieredCache<Toy[]>,
	): JournalPrefetch<Toy[]> {
		return new JournalPrefetch(
			this.scheduler,
			(done, preview, progress) => this.scan(done, progress, preview),
			persisted,
		);
	}
	private ensureFilters(): void {
		if (this.filtersInitialized) return;
		this.filtersInitialized = true;
		C_ToyBoxInfo.SetDefaultFilters();
		C_ToyBox.SetFilterString("");
	}
	private resetQuery(): void {
		this.journal.stop();
		this.querying = true;
		this.querySnapshot = undefined;
		this.backfill = true;
		this.expiredOnly = false;
		this.dirtyIds.clear();
		this.journal = this.createJournal();
	}
	search(text: string): void {
		this.ensureFilters();
		this.resetQuery();
		C_ToyBox.SetFilterString(text);
	}
	getFilters(): CollectionFilter[] {
		this.ensureFilters();
		const api = C_ToyBox as unknown as ToyFilterApi;
		const filters: CollectionFilter[] = [
			{ id: "collected", label: "Collected", checked: api.GetCollectedShown() },
			{
				id: "uncollected",
				label: "Not collected",
				checked: api.GetUncollectedShown(),
			},
			{ id: "usable", label: "Usable only", checked: !api.GetUnusableShown() },
		];
		const labels = _G as unknown as Record<string, string>;
		const sources = (
			C_PetJournal as unknown as { GetNumPetSources(this: void): number }
		).GetNumPetSources();
		for (let index = 1; index <= sources; index++)
			if (C_ToyBoxInfo.IsToySourceValid(index))
				filters.push({
					id: `source:${index}`,
					label: `Source: ${labels[`BATTLE_PET_SOURCE_${index}`]}`,
					checked: api.IsSourceTypeFilterChecked(index),
				});
		for (let index = 1; index <= GetNumExpansions(); index++)
			filters.push({
				id: `expansion:${index}`,
				label: `Expansion: ${labels[`EXPANSION_NAME${index - 1}`]}`,
				checked: api.IsExpansionTypeFilterChecked(index),
			});
		return filters;
	}
	toggleFilter(id: string): void {
		const filter = this.getFilters().find((filter) => filter.id === id);
		if (!filter) return;
		const api = C_ToyBox as unknown as ToyFilterApi;
		this.resetQuery();
		if (id === "collected") api.SetCollectedShown(!filter.checked);
		else if (id === "uncollected") api.SetUncollectedShown(!filter.checked);
		else if (id === "usable") api.SetUnusableShown(filter.checked);
		else {
			const [kind, value] = id.split(":");
			if (kind === "source")
				api.SetSourceTypeFilter(Number(value), !filter.checked);
			else api.SetExpansionTypeFilter(Number(value), !filter.checked);
		}
	}
	prefetch(): void {
		this.backfill = true;
		this.journal.prefetch();
	}
	invalidate(id?: number): void {
		if (this.querying) this.backfill = true;
		if (id !== undefined && id > 0) this.dirtyIds.add(id);
		else this.expiredOnly = true;
		this.journal.invalidate();
	}
	invalidateItem(id: number): boolean {
		if (
			!this.requestedItems.has(id) &&
			this.items?.peek(String(id)) === undefined
		)
			return false;
		this.invalidate(id);
		return true;
	}
	stop(): void {
		this.journal.stop();
		this.items?.stop();
		this.filtersInitialized = false;
		this.querying = false;
		this.querySnapshot = undefined;
		this.journal = this.createJournal(this.snapshots);
	}
	load(
		callback: (toys: Toy[]) => void,
		onProgress?: (completed: number, total: number) => void,
		onFirstPage?: (toys: Toy[]) => void,
		retainCachedView = false,
	): () => void {
		return this.journal.load(
			callback,
			onFirstPage,
			onProgress,
			retainCachedView,
		);
	}
	private scan(
		callback: (toys: Toy[]) => void,
		onProgress?: (completed: number, total: number) => void,
		onFirstPage?: (toys: Toy[]) => void,
	): () => void {
		const toys: Toy[] = [];
		const saved = !this.backfill
			? this.querying
				? this.querySnapshot
				: this.snapshots?.peek("snapshot")
			: undefined;
		const ids = saved?.map((toy) => toy.id);
		for (const id of this.dirtyIds) if (ids && !ids.includes(id)) ids.push(id);
		const targeted =
			this.dirtyIds.size > 0 ? new Set(this.dirtyIds) : undefined;
		const expiredOnly = this.expiredOnly;
		this.expiredOnly = false;
		this.dirtyIds.clear();
		let index = 1;
		let count: number | undefined;
		let cancelled = false;
		let previewed = false;
		const step = () => {
			if (cancelled) return;
			this.ensureFilters();
			count ??= ids?.length ?? C_ToyBox.GetNumFilteredToys();
			const end = Math.min(count, index + 19);
			while (index <= end) {
				const id = ids
					? (ids.at(index++ - 1) ?? 0)
					: C_ToyBox.GetToyFromIndex(index++);
				if (id <= 0) continue;
				const cached = this.items?.peek(String(id));
				const toy =
					cached &&
					((targeted && !targeted.has(id)) ||
						(!targeted && expiredOnly && !this.items?.isExpired(String(id))))
						? cached
						: this.readToy(id);
				if (toy) toys.push(toy);
			}
			onProgress?.(Math.min(count, index - 1), count);
			if (!previewed && toys.length > 0 && index <= count) {
				previewed = true;
				onFirstPage?.([...toys]);
			}
			if (cancelled) return;
			if (index <= count) cancel = this.scheduler.nextFrame(step);
			else {
				this.backfill = false;
				// Retain completed work even if a newer event superseded publication.
				if (this.querying) this.querySnapshot = toys;
				else this.snapshots?.put("snapshot", toys);
				callback(toys);
			}
		};
		let cancel = this.scheduler.nextFrame(step);
		return () => {
			cancelled = true;
			cancel();
		};
	}
	private readToy(id: number): Toy | undefined {
		const previous = this.items?.peek(String(id));
		const [itemId, name, icon, favourite] = C_ToyBox.GetToyInfo(id);
		if (itemId === undefined) return this.items?.peek(String(id));
		const [itemName, , , , , , , , , , , , , , expansionId] =
			C_Item.GetItemInfo(id);
		const loaded = itemName !== undefined && itemName !== "";
		if (!loaded && !this.requestedItems.has(id)) {
			this.requestedItems.add(id);
			C_Item.RequestLoadItemDataByID(id);
		}
		const toy = {
			id,
			name: name || itemName || previous?.name || `Toy ${id}`,
			icon,
			favourite,
			collected: PlayerHasToy(id),
			expansionId: loaded ? expansionId : previous?.expansionId,
		};
		this.items?.put(String(id), toy);
		return toy;
	}
	toggleFavourite(id: number): void {
		if (PlayerHasToy(id)) {
			this.invalidate(id);
			C_ToyBox.SetIsFavorite(id, !C_ToyBox.GetIsFavorite(id));
		}
	}
	canUse(id: number): boolean {
		return !this.isInCombat() && PlayerHasToy(id) && C_ToyBox.IsToyUsable(id);
	}
	isInCombat(): boolean {
		return InCombatLockdown();
	}
	getCooldown(id: number): { start: number; duration: number } {
		const [start, duration] = C_Container.GetItemCooldown(id);
		return { start, duration };
	}
}
