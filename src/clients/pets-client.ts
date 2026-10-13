import type { ICollectionCache } from "./collection-cache";
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
export interface IPetsClient extends Omit<IJournalPrefetch, "invalidate"> {
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
export class PetsClient implements IPetsClient {
	private filtersInitialized = false;
	private fullScan = true;
	private readonly dirtyIds = new Set<string>();
	private readonly items?: TieredCache<Pet>;
	private readonly snapshots?: TieredCache<Pet[]>;
	private readonly journal: JournalPrefetch<Pet[]>;
	constructor(
		private readonly scheduler: ITaskScheduler,
		cache?: ICollectionCache,
	) {
		this.items = cache?.create("pets.items", false, 3600);
		this.snapshots = cache?.create("pets.snapshot", false, 3600);
		this.journal = new JournalPrefetch(
			scheduler,
			(done, preview, progress) => this.scan(done, progress, preview),
			this.snapshots,
		);
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
		const saved = !this.fullScan ? this.snapshots?.peek("snapshot") : undefined;
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
			if (!this.filtersInitialized) {
				this.filtersInitialized = true;
				C_PetJournal.SetDefaultFilters();
				C_PetJournal.ClearSearchFilter();
			}
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
				this.snapshots?.put("snapshot", pets);
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
