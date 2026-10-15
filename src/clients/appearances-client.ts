import type { ICollectionCache } from "./collection-cache";
import {
	CollectionJournal,
	type CollectionPageReader,
	type CollectionUpdate,
} from "./collection-journal";
import {
	type IPerformanceClient,
	quietPerformance,
} from "./performance-client";
import type { SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";

export interface Appearance {
	readonly id: number;
	readonly sourceId: number;
	readonly itemId: number;
	readonly category: number;
	readonly name: string;
	readonly icon: number;
	readonly collected: boolean;
	readonly expansionId?: number;
}
export interface AppearanceSlot {
	readonly id: number;
	readonly name: string;
	readonly icon: number;
}
export interface IAppearancesClient {
	getSlots(): readonly AppearanceSlot[];
	load(
		slot: number,
		done: (rows: Appearance[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<Appearance>,
	): () => void;
	refresh(sourceId?: number, appearanceId?: number): void;
	refreshItem(itemId: number): void;
	stop(): void;
}

// Refine table returns that the declaration generator currently emits as numbers.
interface AppearanceSource {
	visualID: number;
	sourceID: number;
	itemID: number;
	categoryID: number;
	isCollected: boolean;
	name?: string;
}
interface WardrobeApi {
	GetCategoryAppearances(
		this: void,
		category: number,
	): { visualID: number; isCollected: boolean }[] | undefined;
	GetAppearanceSources(
		this: void,
		visual: number,
		category: number,
	): AppearanceSource[] | undefined;
	GetSourceInfo(this: void, source: number): AppearanceSource | undefined;
}
const slots = [
	{ id: 1, name: "Head", icon: 136516, category: 1 },
	{ id: 3, name: "Shoulders", icon: 136526, category: 2 },
	{ id: 15, name: "Back", icon: 136512, category: 3 },
	{ id: 5, name: "Chest", icon: 136512, category: 4 },
	{ id: 4, name: "Shirt", icon: 136525, category: 5 },
	{ id: 19, name: "Tabard", icon: 136527, category: 6 },
	{ id: 9, name: "Wrists", icon: 136530, category: 7 },
	{ id: 10, name: "Hands", icon: 136515, category: 8 },
	{ id: 6, name: "Waist", icon: 136529, category: 9 },
	{ id: 7, name: "Legs", icon: 136521, category: 10 },
	{ id: 8, name: "Feet", icon: 136513, category: 11 },
	{ id: 16, name: "Main Hand", icon: 136518, category: 0 },
	{ id: 17, name: "Off Hand", icon: 136524, category: 0 },
] as const;
interface SlotJournal {
	readonly items: SavedVariableCache<Appearance>;
	readonly journal: CollectionJournal<Appearance>;
	readonly categories: readonly number[];
}
export class AppearancesClient implements IAppearancesClient {
	private readonly opened = new Map<number, SlotJournal>();
	private readonly requested = new Set<number>();
	private filtersInitialized = false;
	private applyingFilters = false;
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly cache: ICollectionCache,
		private readonly performance: IPerformanceClient = quietPerformance,
	) {}
	getSlots(): readonly AppearanceSlot[] {
		return slots;
	}
	private api(): WardrobeApi {
		return C_TransmogCollection as unknown as WardrobeApi;
	}
	private create(slot: number): SlotJournal | undefined {
		const existing = this.opened.get(slot);
		if (existing) return existing;
		const definition = slots.find((entry) => entry.id === slot);
		if (!definition) return undefined;
		const categories: number[] = [];
		if (definition.category > 0) categories.push(definition.category);
		else
			for (let category = 12; category <= 29; category++) {
				const [, , , mainHand, offHand] =
					C_TransmogCollection.GetCategoryInfo(category);
				if (slot === 16 ? mainHand : offHand) categories.push(category);
			}
		const items = this.cache.create<Appearance>(
			`appearances.slot-${slot}`,
			true,
		);
		const read = (visual: number, category: number) => {
			const sources = this.api().GetAppearanceSources(visual, category) ?? [];
			const source =
				sources.find((entry) => entry.isCollected) ?? sources.at(0);
			if (!source) return [];
			const previous = items.peek(String(visual));
			const [name, , , , , , , , , icon, , , , , expansionId] =
				C_Item.GetItemInfo(source.itemID);
			const loaded = name !== undefined && name !== "";
			if (!loaded && !this.requested.has(source.itemID)) {
				this.requested.add(source.itemID);
				C_Item.RequestLoadItemDataByID(source.itemID);
			}
			return [
				{
					id: visual,
					sourceId: source.sourceID,
					itemId: source.itemID,
					category,
					name: loaded
						? name
						: (source.name ?? previous?.name ?? `Appearance ${visual}`),
					icon: icon ?? previous?.icon ?? 134400,
					expansionId: loaded ? expansionId : previous?.expansionId,
					collected: sources.some((entry) => entry.isCollected),
				},
			];
		};
		const begin = (): CollectionPageReader<Appearance> => {
			if (!this.filtersInitialized) {
				this.filtersInitialized = true;
				this.applyingFilters = true;
				C_TransmogCollection.SetDefaultFilters();
				C_TransmogCollection.SetSearch(1, "");
				this.applyingFilters = false;
			}
			const tasks: { visual?: number; category: number }[] = [];
			const first = categories.at(0);
			if (first !== undefined)
				for (const appearance of this.api().GetCategoryAppearances(first) ?? [])
					tasks.push({ visual: appearance.visualID, category: first });
			for (const category of categories.slice(1)) tasks.push({ category });
			const reader: {
				count: number;
				read(this: void, index: number): Appearance[];
			} = {
				count: tasks.length,
				read: (index) => {
					const task = tasks.at(index);
					if (!task) return [];
					if (task.visual !== undefined)
						return read(task.visual, task.category);
					for (const appearance of this.api().GetCategoryAppearances(
						task.category,
					) ?? [])
						tasks.push({
							visual: appearance.visualID,
							category: task.category,
						});
					reader.count = tasks.length;
					return [];
				},
			};
			return reader;
		};
		const journal = new CollectionJournal(
			this.scheduler,
			items,
			(row) => String(row.id),
			() => true,
			begin,
			(key) => {
				const row = items.peek(key);
				return row ? read(row.id, row.category) : [];
			},
			{
				pageSize: 20,
				label: `appearances slot=${slot}`,
				performance: this.performance,
			},
		);
		const store = { items, journal, categories };
		this.opened.set(slot, store);
		// Defer this session's initial warming until this particular slot opens.
		journal.prefetch("first-slot-open");
		return store;
	}
	load(
		slot: number,
		done: (rows: Appearance[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<Appearance>,
	): () => void {
		return (
			this.create(slot)?.journal.load(done, progress, changed) ?? (() => {})
		);
	}
	refresh(sourceId?: number, appearanceId?: number): void {
		if (this.opened.size === 0 || this.applyingFilters) return;
		if (appearanceId !== undefined) {
			for (const store of this.opened.values())
				if (store.items.peek(String(appearanceId)))
					store.journal.refreshEntry(String(appearanceId));
			return;
		}
		if (sourceId === undefined) {
			for (const store of this.opened.values()) store.journal.refreshEntry();
			return;
		}
		const source = this.api().GetSourceInfo(sourceId);
		if (!source) return;
		for (const store of this.opened.values()) {
			if (!store.categories.includes(source.categoryID)) continue;
			// Seed an unseen visual so the journal's targeted reader can resolve it.
			if (!store.items.peek(String(source.visualID)))
				store.items.put(String(source.visualID), {
					id: source.visualID,
					sourceId,
					itemId: source.itemID,
					category: source.categoryID,
					name: source.name ?? `Appearance ${source.visualID}`,
					icon: 134400,
					collected: source.isCollected,
				});
			store.journal.refreshEntry(String(source.visualID));
		}
	}
	refreshItem(itemId: number): void {
		this.requested.delete(itemId);
		for (const store of this.opened.values())
			for (const row of store.items.values())
				if (row.itemId === itemId) store.journal.refreshEntry(String(row.id));
	}
	stop(): void {
		for (const store of this.opened.values()) store.journal.stop();
		this.opened.clear();
		this.requested.clear();
	}
}
