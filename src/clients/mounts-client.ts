import type { ICollectionCache } from "./collection-cache";
import { getMountExpansion } from "./mount-expansions";
import type { CacheChange, SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";

export interface Mount {
	readonly id: number;
	readonly index: number;
	readonly name: string;
	readonly spell: number;
	readonly icon: number;
	readonly collected: boolean;
	readonly usable: boolean;
	readonly favourite: boolean;
	readonly expansionId?: number;
	readonly hidden?: boolean;
}
export interface MountFilter {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
}
export interface IMountJournal {
	prefetch(): void;
	refreshEntry(id?: number): void;
	refreshDisplay(): void;
	stop(): void;
}
export interface IMountsClient extends IMountJournal {
	load(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
			complete: boolean,
		) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void;
	summon(id: number): void;
	canUse(id: number): boolean;
	pickupRandom(): void;
	getMounts(): Mount[];
	getCount(): { collected: number; total: number };
	search(text: string): void;
	getFilters(): MountFilter[];
	toggleFilter(id: string): void;
	setFavourite(
		id: number,
		favourite: boolean,
		onResult: (accepted: boolean) => void,
	): void;
	getFavourite(id: number): boolean;
	getEquipment(): { icon: number; label: string; link?: string };
	applyEquipment(): void;
	getUtilitySpells(): { favourite: number; flight: number };
}
export class MountsClient implements IMountsClient {
	private readonly items: SavedVariableCache<Mount>;
	private cancelScan?: () => void;
	private scanStarted = false;
	private rescan = false;
	private cancelTargets?: () => void;
	private readonly targets = new Set<number>();
	private cancelDisplay?: () => void;
	private displayGeneration = 0;
	private generation = 0;
	private readonly favouriteWrites = new Set<number>();
	private readonly actions = new Set<() => void>();
	private readonly observers = new Set<(this: void) => void>();
	private readonly subscriptions = new Set<() => void>();
	private readonly progress = new Set<
		(this: void, completed: number, total: number) => void
	>();
	constructor(
		private readonly scheduler: ITaskScheduler,
		cache: ICollectionCache,
	) {
		this.items = cache.create<Mount>("mounts.items");
	}
	prefetch(): void {
		this.startScan();
	}
	refreshEntry(id?: number): void {
		if (id === undefined || id <= 0) {
			if (this.cancelScan) this.rescan = this.scanStarted;
			else this.startScan();
			return;
		}
		this.targets.add(id);
		this.scheduleTargets();
	}
	private scheduleTargets(): void {
		if (this.cancelTargets) return;
		const generation = this.generation;
		this.cancelTargets = this.scheduler.nextFrame(() => {
			if (generation !== this.generation) return;
			this.cancelTargets = undefined;
			const changes: CacheChange<Mount>[] = [];
			let remaining = 20;
			for (const id of this.targets) {
				this.targets.delete(id);
				const mount = this.readMount(id);
				if (mount) changes.push({ key: String(id), value: mount });
				if (--remaining === 0) break;
			}
			this.items.putMany(changes);
			if (generation !== this.generation) return;
			if (this.targets.size > 0) this.scheduleTargets();
			this.refreshDisplay();
		});
	}
	private startScan(): void {
		if (this.cancelScan) return;
		const generation = this.generation;
		this.scanStarted = false;
		let ids: number[] | undefined;
		let index = 0;
		const step = () => {
			if (generation !== this.generation) return;
			this.scanStarted = true;
			ids ??= C_MountJournal.GetMountIDs() as unknown as number[];
			const changes: CacheChange<Mount>[] = [];
			const end = Math.min(ids.length, index + 20);
			while (index < end) {
				const id = ids.at(index++);
				if (id !== undefined) {
					const mount = this.readMount(id);
					if (mount) changes.push({ key: String(id), value: mount });
				}
			}
			this.items.putMany(changes);
			if (generation !== this.generation) return;
			for (const observer of this.progress) observer(index, ids.length);
			if (index < ids.length) this.cancelScan = this.scheduler.nextFrame(step);
			else {
				this.cancelScan = undefined;
				this.scanStarted = false;
				if (this.rescan) {
					this.rescan = false;
					this.startScan();
				} else this.refreshDisplay();
			}
		};
		this.cancelScan = this.scheduler.nextFrame(step);
	}
	private readMount(id: number): Mount | undefined {
		const previous = this.items.peek(String(id));
		const [name, spell, icon, , usable, , favourite, , , hidden, collected] =
			C_MountJournal.GetMountInfoByID(id);
		if (!name) return previous;
		return {
			id,
			index: previous?.index ?? id,
			name,
			spell,
			icon,
			usable,
			collected,
			favourite,
			expansionId: getMountExpansion(id),
			hidden,
		};
	}
	/** Search/filter events change a projection, never the journal's cached details. */
	refreshDisplay(): void {
		for (const id of this.favouriteWrites) this.refreshEntry(id);
		this.favouriteWrites.clear();
		this.cancelDisplay?.();
		const generation = this.generation;
		const displayGeneration = ++this.displayGeneration;
		let count: number | undefined;
		let index = 1;
		const indices = new Map<number, number>();
		let cachedIds: number[] | undefined;
		let cursor = 0;
		const step = () => {
			if (
				generation !== this.generation ||
				displayGeneration !== this.displayGeneration
			)
				return;
			count ??= C_MountJournal.GetNumDisplayedMounts();
			let remaining = 20;
			while (index <= count && remaining > 0) {
				const current = index++;
				indices.set(C_MountJournal.GetDisplayedMountID(current), current);
				remaining--;
			}
			const changes: CacheChange<Mount>[] = [];
			if (index > count) {
				cachedIds ??= this.items.values().map((mount) => mount.id);
				while (cursor < cachedIds.length && remaining > 0) {
					const id = cachedIds.at(cursor++);
					const mount =
						id !== undefined ? this.items.peek(String(id)) : undefined;
					if (mount) {
						const displayedIndex = indices.get(mount.id) ?? 0;
						if (mount.index !== displayedIndex)
							changes.push({
								key: String(mount.id),
								value: { ...mount, index: displayedIndex },
							});
					}
					remaining--;
				}
			}
			this.items.putMany(changes);
			if (
				generation !== this.generation ||
				displayGeneration !== this.displayGeneration
			)
				return;
			if (index <= count || (cachedIds && cursor < cachedIds.length))
				this.cancelDisplay = this.scheduler.nextFrame(step);
			else {
				this.cancelDisplay = undefined;
				for (const observer of [...this.observers]) observer();
			}
		};
		this.cancelDisplay = this.scheduler.nextFrame(step);
	}
	load(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
			complete: boolean,
		) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void {
		const publish = () => {
			const values = this.items.values().filter((mount) => !mount.hidden);
			callback(
				this.visible(values),
				{
					collected: values.filter((mount) => mount.collected).length,
					total: values.length,
				},
				!this.cancelScan,
			);
		};
		const detach = this.items.subscribe(publish);
		this.subscriptions.add(detach);
		this.observers.add(publish);
		if (onProgress) this.progress.add(onProgress);
		if (this.items.values().length > 0) publish();
		else this.startScan();
		return () => {
			detach();
			this.subscriptions.delete(detach);
			this.observers.delete(publish);
			if (onProgress) this.progress.delete(onProgress);
		};
	}
	private visible(values: Mount[]): Mount[] {
		return values.filter((mount) => mount.index > 0);
	}
	stop(): void {
		this.generation++;
		this.cancelScan?.();
		this.cancelScan = undefined;
		this.scanStarted = false;
		this.rescan = false;
		this.cancelTargets?.();
		this.cancelTargets = undefined;
		this.targets.clear();
		this.cancelDisplay?.();
		this.cancelDisplay = undefined;
		this.favouriteWrites.clear();
		for (const cancel of this.actions) cancel();
		this.actions.clear();
		this.items.stop();
		for (const detach of this.subscriptions) detach();
		this.subscriptions.clear();
		this.observers.clear();
		this.progress.clear();
	}
	summon(id: number): void {
		C_MountJournal.SummonByID(id);
	}
	canUse(id: number): boolean {
		const [, , , , usable, , , , , hidden, collected] =
			C_MountJournal.GetMountInfoByID(id);
		return collected && !hidden && usable;
	}
	pickupRandom(): void {
		C_MountJournal.Pickup(0);
	}
	getMounts(): Mount[] {
		const values = this.items.values();
		if (values.length === 0) this.startScan();
		return this.visible(values.filter((mount) => !mount.hidden));
	}
	getCount() {
		const mounts = this.items.values().filter((mount) => !mount.hidden);
		return {
			collected: mounts.filter((mount) => mount.collected).length,
			total: mounts.length,
		};
	}
	search(text: string): void {
		C_MountJournal.SetSearch(text);
	}
	getFilters(): MountFilter[] {
		const filters = ["Collected", "Not collected", "Unusable"].map(
			(label, index) => ({
				id: `collection:${index + 1}`,
				label,
				checked: C_MountJournal.GetCollectedFilterSetting(index + 1),
			}),
		);
		for (let index = 1; index <= 5; index++) {
			if (C_MountJournal.IsValidTypeFilter(index))
				filters.push({
					id: `type:${index}`,
					label:
						["Ground", "Flying", "Aquatic", "Skyriding", "Ride along"].at(
							index - 1,
						) ?? `Type ${index}`,
					checked: C_MountJournal.IsTypeChecked(index),
				});
		}
		const sources = (
			C_PetJournal as unknown as { GetNumPetSources(this: void): number }
		).GetNumPetSources();
		for (let index = 1; index <= sources; index++) {
			if (C_MountJournal.IsValidSourceFilter(index))
				filters.push({
					id: `source:${index}`,
					label: `Source: ${["Drop", "Quest", "Vendor", "Profession", "Wild", "Achievement", "World event", "Promotion", "Store", "Trading card", "Discovery", "Trading post"].at(index - 1) ?? index}`,
					checked: C_MountJournal.IsSourceChecked(index),
				});
		}
		return filters;
	}
	toggleFilter(id: string): void {
		const [kind, value] = id.split(":");
		const index = Number(value);
		if (!this.getFilters().some((filter) => filter.id === id)) return;
		if (kind === "collection")
			C_MountJournal.SetCollectedFilterSetting(
				index,
				!C_MountJournal.GetCollectedFilterSetting(index),
			);
		if (kind === "type")
			C_MountJournal.SetTypeFilter(index, !C_MountJournal.IsTypeChecked(index));
		if (kind === "source")
			C_MountJournal.SetSourceFilter(
				index,
				!C_MountJournal.IsSourceChecked(index),
			);
	}
	setFavourite(
		id: number,
		favourite: boolean,
		onResult: (accepted: boolean) => void,
	): void {
		const apply = (index: number) => {
			const [, allowed] = C_MountJournal.GetIsFavorite(index);
			if (allowed) {
				this.favouriteWrites.add(id);
				C_MountJournal.SetIsFavorite(index, favourite);
			}
			onResult(allowed);
		};
		const cached = this.items.peek(String(id))?.index;
		if (
			cached !== undefined &&
			C_MountJournal.GetDisplayedMountID(cached) === id
		) {
			apply(cached);
			return;
		}
		// Favouriting can reorder Blizzard's displayed indices. Resolve IDs only,
		// in bounded batches, rather than rebuilding mount data and collection counts.
		const generation = this.generation;
		const count = C_MountJournal.GetNumDisplayedMounts();
		let index = 1;
		const step = () => {
			if (generation !== this.generation) return;
			const end = Math.min(count, index + 19);
			while (index <= end) {
				const current = index++;
				const displayedId = C_MountJournal.GetDisplayedMountID(current);
				if (displayedId === id) {
					apply(current);
					return;
				}
			}
			if (index <= count) this.scheduleAction(step);
			else onResult(false);
		};
		this.scheduleAction(step);
	}
	private scheduleAction(step: () => void): void {
		const cancel = this.scheduler.nextFrame(() => {
			this.actions.delete(cancel);
			step();
		});
		this.actions.add(cancel);
	}
	getFavourite(id: number): boolean {
		const [, , , , , , favourite] = C_MountJournal.GetMountInfoByID(id);
		return favourite;
	}
	getEquipment() {
		const id = C_MountJournal.GetAppliedMountEquipmentID();
		return {
			icon: id ? (C_Item.GetItemIconByID(id) ?? 134400) : 134400,
			label: id ? "Mount equipment" : "Empty equipment slot",
			link: id ? `item:${id}` : undefined,
		};
	}
	applyEquipment(): void {
		const item = C_Cursor.GetCursorItem() as unknown as object | undefined;
		if (item !== undefined && item !== null) {
			(C_AddOns.LoadAddOn as unknown as (this: void, name: string) => void)(
				"Blizzard_Collections",
			);
			MountJournal.BottomLeftInset.SlotButton.ApplyEquipmentAtCursor();
		}
	}
	getUtilitySpells() {
		return {
			favourite: 150544,
			flight: C_MountJournal.GetDynamicFlightModeSpellID(),
		};
	}
}
