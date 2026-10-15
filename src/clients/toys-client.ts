import type { ICollectionCache } from "./collection-cache";
import {
	CollectionJournal,
	type CollectionPageReader,
	type CollectionUpdate,
	type ICollectionJournal,
} from "./collection-journal";
import type { CollectionFilter, ICollectionQuery } from "./collection-query";
import {
	type IPerformanceClient,
	quietPerformance,
} from "./performance-client";
import type { SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";
import { toysConfig } from "./toys-config";

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
	readonly displayed?: boolean;
}
export interface IToysClient
	extends ICollectionJournal<number>,
		ICollectionQuery {
	refreshItem(id: number): boolean;
	isInCombat(): boolean;
	load(
		callback: (toys: Toy[], complete: boolean) => void,
		onProgress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<Toy>,
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
}

export class ToysClient implements IToysClient {
	private filtersInitialized = false;
	private catalogWarm = false;
	private queryActive = false;
	private applyingQuery = false;
	private readonly pendingQuery: (() => void)[] = [];
	private readonly pendingFilters = new Map<string, boolean>();
	private readonly requestedItems = new Set<number>();
	private readonly items: SavedVariableCache<Toy>;
	private readonly journal: CollectionJournal<Toy>;
	constructor(
		scheduler: ITaskScheduler,
		cache: ICollectionCache,
		performance: IPerformanceClient = quietPerformance,
	) {
		this.items = cache.create<Toy>("toys.items");
		this.journal = new CollectionJournal(
			scheduler,
			this.items,
			(row) => String(row.id),
			(row) => row.displayed !== false,
			() => this.beginScan(),
			(key) => {
				const toy = this.readToy(Number(key));
				return toy ? [toy] : [];
			},
			{ pageSize: toysConfig.scanPageSize, label: "toys", performance },
		);
	}
	private beginScan(): CollectionPageReader<Toy> {
		this.ensureFilters();
		const ids = this.catalogWarm
			? this.items.values().map((row) => row.id)
			: [];
		const known = new Set(ids);
		const displayed = C_ToyBox.GetNumFilteredToys();
		return {
			count: ids.length + displayed,
			read: (index) => {
				const cached = ids.at(index);
				const id = cached ?? C_ToyBox.GetToyFromIndex(index - ids.length + 1);
				if (id <= 0 || (cached === undefined && known.has(id))) return [];
				const row = this.readToy(id);
				return row
					? [{ ...row, displayed: this.catalogWarm ? row.displayed : true }]
					: [];
			},
			finish: () => {
				this.catalogWarm = true;
				const commands = this.pendingQuery.splice(0);
				for (const apply of commands) apply();
				this.pendingFilters.clear();
				if (commands.length > 0 || this.queryActive) this.refreshDisplay();
			},
		};
	}
	private applyQuery(apply: () => void): void {
		this.queryActive = true;
		const run = () => this.changeQuery(apply);
		if (this.journal.isScanning()) this.pendingQuery.push(run);
		else {
			run();
			this.refreshDisplay();
		}
	}
	private changeQuery(apply: () => void): void {
		const previous = this.applyingQuery;
		this.applyingQuery = true;
		apply();
		this.applyingQuery = previous;
	}
	refreshDisplay(): void {
		this.journal.project(() => {
			const count = C_ToyBox.GetNumFilteredToys();
			const ids = this.items.values().map((row) => row.id);
			const visible = new Set<number>();
			return {
				count: count + ids.length,
				read: (index) => {
					if (index < count) {
						visible.add(C_ToyBox.GetToyFromIndex(index + 1));
						return [];
					}
					const id = ids.at(index - count);
					const row =
						id !== undefined ? this.items.peek(String(id)) : undefined;
					if (!row) return [];
					const displayed = visible.has(row.id);
					return row.displayed === displayed ? [] : [{ ...row, displayed }];
				},
			};
		});
	}
	private ensureFilters(): void {
		if (this.filtersInitialized) return;
		this.filtersInitialized = true;
		this.changeQuery(() => {
			C_ToyBoxInfo.SetDefaultFilters();
			C_ToyBox.SetFilterString("");
		});
	}
	search(text: string): void {
		this.applyQuery(() => {
			this.ensureFilters();
			C_ToyBox.SetFilterString(text);
		});
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
		return filters.map((filter) => ({
			...filter,
			checked: this.pendingFilters.get(filter.id) ?? filter.checked,
		}));
	}
	toggleFilter(id: string): void {
		const filter = this.getFilters().find((filter) => filter.id === id);
		if (!filter) return;
		this.pendingFilters.set(id, !filter.checked);
		const api = C_ToyBox as unknown as ToyFilterApi;
		this.applyQuery(() => {
			if (id === "collected") api.SetCollectedShown(!filter.checked);
			else if (id === "uncollected") api.SetUncollectedShown(!filter.checked);
			else if (id === "usable") api.SetUnusableShown(filter.checked);
			else {
				const [, value] = id.split(":");
				api.SetSourceTypeFilter(Number(value), !filter.checked);
			}
		});
		if (!this.journal.isScanning()) this.pendingFilters.delete(id);
	}
	prefetch(): void {
		this.journal.prefetch();
	}
	refreshEntry(id?: number): void {
		if (id === undefined && this.applyingQuery) return;
		this.journal.refreshEntry(
			id !== undefined && id > 0 ? String(id) : undefined,
		);
	}
	refreshItem(id: number): boolean {
		if (!this.requestedItems.has(id) && !this.items.peek(String(id)))
			return false;
		this.refreshEntry(id);
		return true;
	}
	stop(): void {
		this.journal.stop();
		this.pendingQuery.length = 0;
		this.pendingFilters.clear();
		this.requestedItems.clear();
	}
	load(
		callback: (toys: Toy[], complete: boolean) => void,
		onProgress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<Toy>,
	): () => void {
		return this.journal.load(callback, onProgress, changed);
	}
	private readToy(id: number): Toy | undefined {
		const previous = this.items.peek(String(id));
		const [itemId, name, icon, favourite] = C_ToyBox.GetToyInfo(id);
		if (itemId === undefined) return this.items.peek(String(id));
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
			displayed: previous?.displayed,
		};
		return toy;
	}
	toggleFavourite(id: number): void {
		this.applyQuery(() => {
			if (PlayerHasToy(id)) {
				C_ToyBox.SetIsFavorite(id, !C_ToyBox.GetIsFavorite(id));
				this.journal.refreshEntry(String(id));
			}
		});
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
