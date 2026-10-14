import type { ICollectionCache } from "./collection-cache";
import type { CollectionFilter, ICollectionQuery } from "./collection-query";
import { type IJournalPrefetch, JournalPrefetch } from "./journal-prefetch";
import { getPetExpansion } from "./pet-expansions";
import type { ITaskScheduler } from "./task-scheduler";
import type { TieredCache } from "./tiered-cache";

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
}
export interface IPetsClient
	extends Omit<IJournalPrefetch, "invalidate">,
		ICollectionQuery {
	invalidate(id?: string): void;
	load(
		done: (pets: Pet[]) => void,
		progress?: (completed: number, total: number) => void,
		preview?: (pets: Pet[]) => void,
		retainCachedView?: boolean,
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
	private fullScan = true;
	private readonly dirtyIds = new Set<string>();
	private readonly items?: TieredCache<Pet>;
	private readonly snapshots?: TieredCache<Pet[]>;
	private journal: JournalPrefetch<Pet[]>;
	private querying = false;
	private querySnapshot?: Pet[];
	constructor(
		private readonly scheduler: ITaskScheduler,
		cache?: ICollectionCache,
	) {
		this.items = cache?.create("pets.items", false, 3600);
		this.snapshots = cache?.create("pets.snapshot", false, 3600);
		this.journal = this.createJournal(this.snapshots);
	}
	private createJournal(
		persisted?: TieredCache<Pet[]>,
	): JournalPrefetch<Pet[]> {
		return new JournalPrefetch(
			this.scheduler,
			(done, preview, progress) => this.scan(done, progress, preview),
			persisted,
		);
	}
	private ensureFilters(): void {
		if (this.filtersInitialized) return;
		this.filtersInitialized = true;
		C_PetJournal.SetDefaultFilters();
		C_PetJournal.ClearSearchFilter();
	}
	private resetQuery(): void {
		this.journal.stop();
		this.querying = true;
		this.querySnapshot = undefined;
		this.fullScan = true;
		this.dirtyIds.clear();
		this.journal = this.createJournal();
	}
	search(text: string): void {
		this.ensureFilters();
		this.resetQuery();
		C_PetJournal.SetSearchFilter(text);
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
		return filters;
	}
	toggleFilter(id: string): void {
		const filter = this.getFilters().find((filter) => filter.id === id);
		if (!filter) return;
		const api = C_PetJournal as unknown as PetFilterApi;
		this.resetQuery();
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
	}
	prefetch(): void {
		this.fullScan = true;
		this.journal.prefetch();
	}
	invalidate(id?: string): void {
		if (id && this.items?.peek(id)) this.dirtyIds.add(id);
		else this.fullScan = true;
		this.journal.invalidate();
	}
	stop(): void {
		this.journal.stop();
		this.items?.stop();
		this.filtersInitialized = false;
		this.fullScan = true;
		this.querying = false;
		this.querySnapshot = undefined;
		this.journal = this.createJournal(this.snapshots);
	}
	load(
		done: (pets: Pet[]) => void,
		progress?: (completed: number, total: number) => void,
		preview?: (pets: Pet[]) => void,
		retainCachedView = false,
	): () => void {
		return this.journal.load(done, preview, progress, retainCachedView);
	}
	private scan(
		done: (pets: Pet[]) => void,
		progress?: (completed: number, total: number) => void,
		preview?: (pets: Pet[]) => void,
	): () => void {
		const saved = !this.fullScan
			? this.querying
				? this.querySnapshot
				: this.snapshots?.peek("snapshot")
			: undefined;
		const dirty = new Set(this.dirtyIds);
		this.dirtyIds.clear();
		this.fullScan = false;
		const pets: Pet[] = [];
		const seen = new Set<string>();
		let count: number | undefined,
			index = 0,
			cancelled = false,
			previewed = false;
		const step = () => {
			if (cancelled) return;
			this.ensureFilters();
			if (count === undefined) {
				if (saved) count = saved.length;
				else {
					const [total] = C_PetJournal.GetNumPets();
					count = total;
				}
			}
			const end = Math.min(count, index + 20);
			while (index < end) {
				const previous = saved?.at(index);
				index++;
				let pet: Pet | undefined;
				if (previous) {
					pet = previous;
					if (
						previous.collected &&
						(dirty.has(previous.id) || this.items?.isExpired(previous.id))
					) {
						const [speciesId, customName, , , , , favourite, name, icon] =
							C_PetJournal.GetPetInfoByPetID(previous.id);
						if (speciesId)
							pet = { ...previous, name: customName || name, icon, favourite };
					}
				} else {
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
					] = C_PetJournal.GetPetInfoByIndex(index);
					if (speciesId && !revoked)
						pet = {
							id: collected && guid ? guid : `species-${speciesId}`,
							speciesId,
							name: customName || name || `Pet ${speciesId}`,
							icon,
							collected: collected && !!guid,
							favourite: collected && favourite,
							expansionId: getPetExpansion(speciesId),
						};
				}
				if (pet && !seen.has(pet.id)) {
					seen.add(pet.id);
					pets.push(pet);
					// Reusing an item must not renew its TTL without a native read.
					if (pet !== previous) this.items?.put(pet.id, pet);
				}
			}
			progress?.(index, count);
			if (!previewed && pets.length > 0 && index < count) {
				previewed = true;
				preview?.([...pets]);
			}
			if (cancelled) return;
			if (index < count) cancel = this.scheduler.nextFrame(step);
			else {
				if (this.querying) this.querySnapshot = pets;
				else this.snapshots?.put("snapshot", pets);
				done(pets);
			}
		};
		let cancel = this.scheduler.nextFrame(step);
		return () => {
			cancelled = true;
			cancel();
		};
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
		const [species, , , , , , favourite] = C_PetJournal.GetPetInfoByPetID(id);
		if (!species) return;
		this.invalidate(id);
		C_PetJournal.SetFavorite(id, favourite ? 0 : 1);
	}
}
