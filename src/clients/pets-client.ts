import type { ICollectionCache } from "./collection-cache";
import {
	CollectionJournal,
	type CollectionPageReader,
	type ICollectionJournal,
} from "./collection-journal";
import type { CollectionFilter, ICollectionQuery } from "./collection-query";
import { getPetExpansion } from "./pet-expansions";
import type { SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";

// Legacy journal enumeration and GUID APIs are absent from the generated surface.
declare global {
	namespace C_PetJournal {
		function GetNumPets(this: void): LuaMultiReturn<[number, number]>;
		function GetPetInfoByIndex(
			this: void,
			index: number,
		): LuaMultiReturn<
			[
				string | undefined,
				number,
				boolean,
				string | undefined,
				number,
				boolean,
				boolean,
				string,
				number,
				number | undefined,
				number | undefined,
				string | undefined,
				string | undefined,
			]
		>;
		function GetPetInfoByPetID(
			this: void,
			id: string,
		): LuaMultiReturn<
			[
				number | undefined,
				string | undefined,
				number,
				number,
				number,
				number,
				boolean,
				string,
				number,
				number | undefined,
				number | undefined,
				string | undefined,
				string | undefined,
			]
		>;
		function SummonPetByGUID(this: void, id: string): void;
		function SummonRandomPet(this: void, favourites: boolean): void;
		function SetFavorite(this: void, id: string, favourite: number): void;
	}
}
export interface Pet {
	readonly id: string;
	readonly speciesId: number;
	readonly name: string;
	readonly icon: number;
	readonly collected: boolean;
	readonly favourite: boolean;
	readonly expansionId?: number;
	readonly source?: string;
	readonly description?: string;
	readonly ownedCount?: number;
	readonly collectionLimit?: number;
	readonly displayed?: boolean;
	readonly present?: boolean;
}
export interface IPetsClient
	extends ICollectionJournal<string>,
		ICollectionQuery {
	refreshEntry(id?: string, removed?: boolean): void;
	load(
		done: (pets: Pet[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
	): () => void;
	isInCombat(): boolean;
	canUse(id: string): boolean;
	summon(id: string): void;
	summonFavourite(): void;
	toggleFavourite(id: string): void;
}
// Legacy filter APIs are not included in the generated documentation surface.
interface PetFilterApi {
	IsFilterChecked(this: void, filter: number): boolean;
	SetFilterChecked(this: void, filter: number, checked: boolean): void;
	GetNumPetTypes(this: void): number;
	IsPetTypeChecked(this: void, index: number): boolean;
	SetPetTypeFilter(this: void, index: number, checked: boolean): void;
	GetNumPetSources(this: void): number;
	IsPetSourceChecked(this: void, index: number): boolean;
	SetPetSourceChecked(this: void, index: number, checked: boolean): void;
}

const petFilterKinds = [
	{
		id: "collected",
		label: "Collected",
		constant: "LE_PET_JOURNAL_FILTER_COLLECTED",
	},
	{
		id: "uncollected",
		label: "Not collected",
		constant: "LE_PET_JOURNAL_FILTER_NOT_COLLECTED",
	},
	{
		id: "battle",
		label: "Battle pets",
		constant: "LE_PET_JOURNAL_FILTER_TYPE_BATTLE_PETS",
	},
	{
		id: "noncombat",
		label: "Non-combat pets",
		constant: "LE_PET_JOURNAL_FILTER_TYPE_NON_COMBAT_PETS",
	},
];

export class PetsClient implements IPetsClient {
	private filtersInitialized = false;
	private catalogWarm = false;
	private queryActive = false;
	private applyingQuery = false;
	private readonly pendingQuery: (() => void)[] = [];
	private readonly pendingFilters = new Map<string, boolean>();
	private readonly removed = new Set<string>();
	private readonly items: SavedVariableCache<Pet>;
	private readonly journal: CollectionJournal<Pet>;
	constructor(scheduler: ITaskScheduler, cache: ICollectionCache) {
		this.items = cache.create<Pet>("pets.items");
		this.journal = new CollectionJournal(
			scheduler,
			this.items,
			(row) => row.id,
			(row) => row.present !== false && row.displayed !== false,
			() => this.beginScan(),
			(id) => this.readTarget(id, true),
		);
	}
	private beginScan(): CollectionPageReader<Pet> {
		this.ensureFilters();
		if (!this.catalogWarm) {
			const [count] = C_PetJournal.GetNumPets();
			return {
				count,
				read: (index) => this.readIndex(index + 1),
				finish: () => this.finishScan(),
			};
		}
		// GetOwnedPetIDs is an unfiltered Lua table; generated scalar annotations omit it.
		const owned = (
			C_PetJournal.GetOwnedPetIDs as unknown as (this: void) => string[]
		)();
		const ownership = new Set(owned);
		const ids = this.items.values().map((row) => row.id);
		for (const id of owned) if (!ids.includes(id)) ids.push(id);
		const [count] = C_PetJournal.GetNumPets();
		const known = new Set(ids);
		return {
			count: ids.length + count,
			read: (index) => {
				const id = ids.at(index);
				if (id !== undefined) {
					if (id.startsWith("species-")) {
						const previous = this.items.peek(id);
						if (!previous) return [];
						const counts = this.collectionCount(previous.speciesId);
						return [
							{ ...previous, ...counts, present: counts.ownedCount === 0 },
						];
					}
					return ownership.has(id) ? this.readTarget(id) : this.removeOwned(id);
				}
				const [guid, species] = C_PetJournal.GetPetInfoByIndex(
					index - ids.length + 1,
				);
				const key = guid || `species-${species}`;
				if (known.has(key)) return [];
				return this.readIndex(index - ids.length + 1);
			},
			finish: () => this.finishScan(),
		};
	}
	private finishScan(): void {
		this.catalogWarm = true;
		const commands = this.pendingQuery.splice(0);
		for (const apply of commands) apply();
		this.pendingFilters.clear();
		if (commands.length > 0 || this.queryActive) this.refreshDisplay();
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
			const [count] = C_PetJournal.GetNumPets();
			const ids = this.items.values().map((row) => row.id);
			const visible = new Set<string>();
			return {
				count: count + ids.length,
				read: (index) => {
					if (index < count) {
						const [guid, species, collected] = C_PetJournal.GetPetInfoByIndex(
							index + 1,
						);
						visible.add(collected && guid ? guid : `species-${species}`);
						return [];
					}
					const id = ids.at(index - count);
					const row = id !== undefined ? this.items.peek(id) : undefined;
					if (!row) return [];
					const displayed = visible.has(row.id);
					return row.displayed === displayed ? [] : [{ ...row, displayed }];
				},
			};
		});
	}
	private readIndex(index: number): Pet[] {
		const [
			guid,
			speciesId,
			collected,
			customName,
			,
			favourite,
			revoked,
			name,
			icon,
			,
			,
			source,
			description,
		] = C_PetJournal.GetPetInfoByIndex(index);
		if (!speciesId) return [];
		const id = collected && guid ? guid : `species-${speciesId}`;
		const previous = this.items.peek(id);
		return [
			{
				id,
				speciesId,
				name: customName || name || previous?.name || `Pet ${speciesId}`,
				icon,
				collected: collected && !!guid,
				favourite: collected && favourite,
				expansionId: getPetExpansion(speciesId),
				source,
				description,
				...this.collectionCount(speciesId),
				present:
					!revoked && !this.removed.has(id) && previous?.present !== false,
				displayed: this.catalogWarm ? previous?.displayed : true,
			},
		];
	}
	private readTarget(id: string, restore = false): Pet[] {
		if (this.removed.has(id)) {
			// Only the targeted event consumes its payload; scans must not steal it.
			if (restore) this.removed.delete(id);
			return this.removeOwned(id);
		}
		if (id.startsWith("species-")) return [];
		const previous = this.items.peek(id);
		if (!restore && previous?.present === false) return this.removeOwned(id);
		const [
			speciesId,
			customName,
			,
			,
			,
			,
			favourite,
			name,
			icon,
			,
			,
			source,
			description,
		] = C_PetJournal.GetPetInfoByPetID(id);
		if (!speciesId) return previous ? [previous] : [];
		const counts = this.collectionCount(speciesId);
		const pet: Pet = {
			id,
			speciesId,
			name: customName || name || previous?.name || `Pet ${speciesId}`,
			icon,
			collected: true,
			favourite,
			expansionId: getPetExpansion(speciesId),
			source: source ?? previous?.source,
			description: description ?? previous?.description,
			...counts,
			present: true,
			displayed: previous?.displayed,
		};
		const rows = [pet];
		for (const copy of this.items.values()) {
			if (copy.id === id || copy.speciesId !== speciesId) continue;
			rows.push({
				...copy,
				...counts,
				present: copy.id.startsWith("species-")
					? counts.ownedCount === 0
					: copy.present,
			});
		}
		return rows;
	}
	private removeOwned(id: string): Pet[] {
		const previous = this.items.peek(id);
		if (!previous) return [];
		const counts = this.collectionCount(previous.speciesId);
		const rows: Pet[] = [
			{
				...previous,
				...counts,
				collected: false,
				favourite: false,
				present: false,
			},
		];
		for (const copy of this.items.values()) {
			if (copy.id !== id && copy.speciesId === previous.speciesId)
				rows.push({
					...copy,
					...counts,
					present: copy.id.startsWith("species-")
						? counts.ownedCount === 0
						: copy.present,
				});
		}
		if (counts.ownedCount === 0)
			rows.push({
				...previous,
				...counts,
				id: `species-${previous.speciesId}`,
				collected: false,
				favourite: false,
				present: true,
			});
		return rows;
	}
	private ensureFilters(): void {
		if (this.filtersInitialized) return;
		this.filtersInitialized = true;
		this.changeQuery(() => {
			C_PetJournal.SetDefaultFilters();
			C_PetJournal.ClearSearchFilter();
		});
	}
	search(text: string): void {
		this.applyQuery(() => {
			this.ensureFilters();
			C_PetJournal.SetSearchFilter(text);
		});
	}
	getFilters(): CollectionFilter[] {
		this.ensureFilters();
		const api = C_PetJournal as unknown as PetFilterApi;
		const globals = _G as unknown as Record<string, number>;
		const labels = _G as unknown as Record<string, string>;
		const filters: CollectionFilter[] = petFilterKinds.map((kind) => ({
			id: kind.id,
			label: kind.label,
			checked: api.IsFilterChecked(globals[kind.constant]),
		}));
		for (let index = 1; index <= api.GetNumPetTypes(); index++)
			filters.push({
				id: `family:${index}`,
				label: `Family: ${labels[`BATTLE_PET_NAME_${index}`]}`,
				checked: api.IsPetTypeChecked(index),
			});
		for (let index = 1; index <= api.GetNumPetSources(); index++)
			filters.push({
				id: `source:${index}`,
				label: `Source: ${labels[`BATTLE_PET_SOURCE_${index}`]}`,
				checked: api.IsPetSourceChecked(index),
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
		const api = C_PetJournal as unknown as PetFilterApi;
		this.applyQuery(() => {
			const kind = petFilterKinds.find((kind) => kind.id === id);
			if (kind)
				api.SetFilterChecked(
					(_G as unknown as Record<string, number>)[kind.constant],
					!filter.checked,
				);
			else {
				const [group, value] = id.split(":");
				if (group === "family")
					api.SetPetTypeFilter(Number(value), !filter.checked);
				else api.SetPetSourceChecked(Number(value), !filter.checked);
			}
		});
		if (!this.journal.isScanning()) this.pendingFilters.delete(id);
	}
	prefetch(): void {
		this.journal.prefetch();
	}
	refreshEntry(id?: string, removed = false): void {
		if (id === undefined && this.applyingQuery) return;
		if (id) {
			if (removed) this.removed.add(id);
			else this.removed.delete(id);
		}
		this.journal.refreshEntry(id);
	}
	stop(): void {
		this.journal.stop();
		this.pendingQuery.length = 0;
		this.pendingFilters.clear();
		this.removed.clear();
	}
	load(
		done: (pets: Pet[], complete: boolean) => void,
		progress?: (completed: number, total: number) => void,
	): () => void {
		return this.journal.load(done, progress);
	}
	private collectionCount(speciesId: number): {
		ownedCount: number;
		collectionLimit: number;
	} {
		const [ownedCount, collectionLimit] = (
			C_PetJournal as unknown as {
				GetNumCollectedInfo(
					this: void,
					speciesId: number,
				): LuaMultiReturn<[number, number]>;
			}
		).GetNumCollectedInfo(speciesId);
		return { ownedCount, collectionLimit };
	}
	isInCombat(): boolean {
		return InCombatLockdown();
	}
	canUse(id: string): boolean {
		return (
			!this.isInCombat() &&
			!id.startsWith("species-") &&
			(
				C_PetJournal.PetIsSummonable as unknown as (
					this: void,
					guid: string,
				) => boolean
			)(id)
		);
	}
	summon(id: string): void {
		if (this.canUse(id)) C_PetJournal.SummonPetByGUID(id);
	}
	summonFavourite(): void {
		if (!this.isInCombat()) C_PetJournal.SummonRandomPet(true);
	}
	toggleFavourite(id: string): void {
		if (this.isInCombat() || id.startsWith("species-")) return;
		this.applyQuery(() => {
			if (this.isInCombat()) return;
			const [species, , , , , , favourite] = C_PetJournal.GetPetInfoByPetID(id);
			if (!species) return;
			C_PetJournal.SetFavorite(id, favourite ? 0 : 1);
			this.journal.refreshEntry(id);
		});
	}
}
