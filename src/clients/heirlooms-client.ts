import type { ICollectionCache } from "./collection-cache";
import {
	CollectionJournal,
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

// Legacy APIs used by Blizzard_HeirloomCollection.lua are absent from generated documentation.
declare global {
	namespace C_Heirloom {
		function GetNumDisplayedHeirlooms(this: void): number;
		function GetHeirloomItemIDFromDisplayedIndex(
			this: void,
			index: number,
		): number;
		function GetHeirloomInfo(
			this: void,
			id: number,
		): LuaMultiReturn<
			[
				string | undefined,
				string,
				boolean,
				number,
				number,
				string,
				boolean,
				number,
				number,
				number,
			]
		>;
		function PlayerHasHeirloom(this: void, id: number): boolean;
		function SetSearch(this: void, text: string): void;
		function SetClassAndSpecFilters(
			this: void,
			classId: number,
			specId: number,
		): void;
		function CreateHeirloom(this: void, id: number): void;
		function GetHeirloomLink(this: void, id: number): string | undefined;
	}
	const UNSPECIFIED_CLASS_FILTER: number;
	const UNSPECIFIED_SPEC_FILTER: number;
}
export interface Heirloom {
	readonly id: number;
	readonly name: string;
	readonly icon: number;
	readonly collected: boolean;
	readonly equipLocation: string;
	readonly upgradeLevel: number;
	readonly maxLevel: number;
	readonly source: string;
	readonly link?: string;
	readonly displayed: boolean;
}
export interface IHeirloomsClient
	extends ICollectionJournal<number>,
		ICollectionQuery {
	load(
		callback: (rows: Heirloom[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<Heirloom>,
	): () => void;
	create(id: number): void;
	isInCombat(): boolean;
}
export class HeirloomsClient implements IHeirloomsClient {
	private readonly items: SavedVariableCache<Heirloom>;
	private readonly journal: CollectionJournal<Heirloom>;
	private text = "";
	private collected = true;
	private uncollected = true;
	private scanning = false;
	constructor(
		scheduler: ITaskScheduler,
		cache: ICollectionCache,
		performance: IPerformanceClient = quietPerformance,
	) {
		this.items = cache.create<Heirloom>("heirlooms.items");
		this.journal = new CollectionJournal(
			scheduler,
			this.items,
			(row) => String(row.id),
			(row) => row.displayed,
			() => {
				this.scanning = true;
				C_HeirloomInfo.SetDefaultFilters();
				C_HeirloomInfo.SetAllCollectionFilters(true);
				C_HeirloomInfo.SetAllSourceFilters(true);
				C_Heirloom.SetSearch("");
				C_Heirloom.SetClassAndSpecFilters(
					UNSPECIFIED_CLASS_FILTER,
					UNSPECIFIED_SPEC_FILTER,
				);
				return {
					count: C_Heirloom.GetNumDisplayedHeirlooms(),
					read: (index) => {
						const row = this.read(
							C_Heirloom.GetHeirloomItemIDFromDisplayedIndex(index + 1),
						);
						return row ? [row] : [];
					},
					finish: () => {
						this.scanning = false;
						this.project();
					},
				};
			},
			(key) => {
				const row = this.read(Number(key));
				return row ? [row] : [];
			},
			{ pageSize: 20, label: "heirlooms", performance },
		);
	}
	private included(row: Heirloom): boolean {
		return (
			(row.collected ? this.collected : this.uncollected) &&
			row.name.toLowerCase().includes(this.text)
		);
	}
	private read(id: number): Heirloom | undefined {
		if (id <= 0) return;
		const [name, equipLocation, , icon, upgradeLevel, source, , , , maxLevel] =
			C_Heirloom.GetHeirloomInfo(id);
		if (!name) return this.items.peek(String(id));
		const row = {
			id,
			name,
			icon,
			equipLocation,
			upgradeLevel,
			source,
			maxLevel,
			link: C_Heirloom.GetHeirloomLink(id),
			collected: C_Heirloom.PlayerHasHeirloom(id),
			displayed: true,
		};
		return { ...row, displayed: this.included(row) };
	}
	private project(): void {
		this.journal.project(() => {
			const rows = this.items.values();
			return {
				count: rows.length,
				read: (index) => {
					const row = rows.at(index);
					if (!row) return [];
					const displayed = this.included(row);
					return displayed === row.displayed ? [] : [{ ...row, displayed }];
				},
			};
		});
	}
	search(text: string): void {
		this.text = text.toLowerCase();
		this.project();
	}
	getFilters(): CollectionFilter[] {
		return [
			{ id: "collected", label: "Collected", checked: this.collected },
			{ id: "uncollected", label: "Not collected", checked: this.uncollected },
		];
	}
	toggleFilter(id: string): void {
		if (id === "collected") this.collected = !this.collected;
		else if (id === "uncollected") this.uncollected = !this.uncollected;
		else return;
		this.project();
	}
	prefetch(): void {
		this.journal.prefetch();
	}
	refreshEntry(id?: number): void {
		if (id === undefined && this.scanning) return;
		this.journal.refreshEntry(id === undefined ? undefined : String(id));
	}
	stop(): void {
		this.scanning = false;
		this.journal.stop();
	}
	load(
		callback: (rows: Heirloom[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
		changed?: CollectionUpdate<Heirloom>,
	): () => void {
		return this.journal.load(callback, progress, changed);
	}
	isInCombat(): boolean {
		return InCombatLockdown();
	}
	create(id: number): void {
		if (!this.isInCombat() && C_Heirloom.PlayerHasHeirloom(id))
			C_Heirloom.CreateHeirloom(id);
	}
}
