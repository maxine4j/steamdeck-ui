import type { ICollectionCache } from "./collection-cache";
import { type IJournalPrefetch, JournalPrefetch } from "./journal-prefetch";
import { getMountExpansion } from "./mount-expansions";
import type { ITaskScheduler } from "./task-scheduler";
import type { TieredCache } from "./tiered-cache";

interface MountSnapshot {
	mounts: Mount[];
	count: { collected: number; total: number };
}

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
}
export interface MountFilter {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
}
export interface IMountsClient extends IJournalPrefetch {
	load(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
		) => void,
		onFirstPage?: (mounts: Mount[]) => void,
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
	private readonly indices = new Map<number, number>();
	private displayRevision = 0;
	private readonly items?: TieredCache<Mount>;
	private readonly snapshots?: TieredCache<MountSnapshot>;
	private backfill = false;
	private expiredOnly = false;
	private readonly dirtyIds = new Set<number>();
	private readonly journal: JournalPrefetch<
		{
			mounts: Mount[];
			count: { collected: number; total: number };
		},
		Mount[]
	>;
	constructor(
		private readonly scheduler: ITaskScheduler,
		cache?: ICollectionCache,
	) {
		this.items = cache?.create("mounts.items", false, 3600);
		this.snapshots = cache?.create("mounts.snapshot", false, 3600);
		this.journal = new JournalPrefetch(
			scheduler,
			(done, preview, progress) =>
				this.scan(
					(mounts, count) => done({ mounts, count }),
					preview,
					progress,
				),
			this.snapshots,
		);
	}
	prefetch(): void {
		this.backfill = true;
		this.journal.prefetch();
	}
	invalidate(id?: number): void {
		if (id !== undefined && id > 0) this.dirtyIds.add(id);
		else this.expiredOnly = true;
		this.journal.invalidate();
	}
	stop(): void {
		this.journal.stop();
		this.items?.stop();
	}
	load(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
		) => void,
		onFirstPage?: (mounts: Mount[]) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void {
		return this.journal.load(
			({ mounts, count }) => callback(mounts, count),
			onFirstPage,
			onProgress,
		);
	}
	private scan(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
		) => void,
		onFirstPage?: (mounts: Mount[]) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void {
		const mounts: Mount[] = [];
		const saved = !this.backfill ? this.snapshots?.peek("snapshot") : undefined;
		const targeted =
			this.dirtyIds.size > 0 ? new Set(this.dirtyIds) : undefined;
		const expiredOnly = this.expiredOnly;
		this.expiredOnly = false;
		const changedIds = saved && targeted ? [...targeted] : [];
		let changedIndex = 0;
		this.dirtyIds.clear();
		const seen = new Set<number>();
		let revision = this.displayRevision;
		let ids: number[] | undefined;
		let displayed = 0;
		let index = 1;
		let countIndex = 0;
		let collected = saved?.count.collected ?? 0;
		let total = saved?.count.total ?? 0;
		let publishedFirstPage = false;
		let cancelled = false;
		const step = () => {
			if (cancelled) return;
			if (!ids) {
				displayed = C_MountJournal.GetNumDisplayedMounts();
				ids = saved
					? []
					: (C_MountJournal.GetMountIDs() as unknown as number[]);
			}
			if (revision !== this.displayRevision) {
				// Removing a favourite can shift an unread mount behind the scan's
				// cursor. Overlap one position per write and deduplicate by stable ID.
				index = Math.max(1, index - (this.displayRevision - revision));
				revision = this.displayRevision;
			}
			// Bound API work per frame, including the unfiltered collection count.
			let remaining = 20;
			while (changedIndex < changedIds.length && remaining > 0) {
				const id = changedIds.at(changedIndex++);
				if (id !== undefined) {
					const previous = this.items?.peek(String(id));
					const mount = this.readMount(id, previous?.index ?? 0);
					if (mount) {
						if (!previous) {
							total++;
							if (mount.collected) collected++;
						} else if (previous.collected !== mount.collected)
							collected += mount.collected ? 1 : -1;
					}
				}
				remaining--;
			}
			while (index <= displayed && remaining > 0) {
				const current = index++;
				let mount: Mount | undefined;
				if (saved && this.items) {
					const id = C_MountJournal.GetDisplayedMountID(current);
					const previous = this.items.peek(String(id));
					mount =
						previous &&
						(targeted || (expiredOnly && !this.items.isExpired(String(id))))
							? { ...previous, index: current }
							: this.readMount(id, current);
					if (mount) {
						if (!previous) {
							total++;
							if (mount.collected) collected++;
						} else if (previous.collected !== mount.collected)
							collected += mount.collected ? 1 : -1;
					}
				} else mount = this.getDisplayedMount(current);
				if (mount && !seen.has(mount.id)) {
					seen.add(mount.id);
					mounts.push(mount);
				}
				remaining--;
			}
			if (!publishedFirstPage && (mounts.length >= 20 || index > displayed)) {
				publishedFirstPage = true;
				// Publish a stable preview before the unfiltered count is available.
				onFirstPage?.(mounts.slice(0, 20));
				if (cancelled) return;
			}
			while (countIndex < ids.length && remaining > 0) {
				const id = ids.at(countIndex++);
				if (id !== undefined) {
					const [name, spell, icon, , usable, , favourite, , , hidden, owned] =
						C_MountJournal.GetMountInfoByID(id);
					if (!hidden) {
						if (name !== undefined && name !== "")
							this.items?.put(String(id), {
								id,
								index: this.indices.get(id) ?? 0,
								name,
								spell,
								icon,
								usable,
								favourite,
								collected: owned,
								expansionId: getMountExpansion(id),
							});
						total++;
						if (owned) collected++;
					}
				}
				remaining--;
			}
			onProgress?.(index - 1 + countIndex, displayed + ids.length);
			if (cancelled) return;
			if (
				changedIndex < changedIds.length ||
				index <= displayed ||
				countIndex < ids.length
			)
				cancel = this.scheduler.nextFrame(step);
			else {
				this.backfill = false;
				// A superseded scan still owns valid per-item and count updates.
				this.snapshots?.put("snapshot", {
					mounts,
					count: { collected, total },
				});
				callback(mounts, { collected, total });
			}
		};
		let cancel = this.scheduler.nextFrame(step);
		return () => {
			cancelled = true;
			cancel();
		};
	}
	private readMount(id: number, index: number): Mount | undefined {
		const [name, spell, icon, , usable, , favourite, , , hidden, collected] =
			C_MountJournal.GetMountInfoByID(id);
		if (!name) return this.items?.peek(String(id));
		if (hidden) return undefined;
		const mount = {
			id,
			index,
			name,
			spell,
			icon,
			usable,
			collected,
			favourite,
			expansionId: getMountExpansion(id),
		};
		this.indices.set(id, index);
		this.items?.put(String(id), mount);
		return mount;
	}
	private getDisplayedMount(index: number): Mount | undefined {
		const [
			name,
			spell,
			icon,
			,
			usable,
			,
			favourite,
			,
			,
			hidden,
			collected,
			id,
		] = C_MountJournal.GetDisplayedMountInfo(index);
		if (hidden) return undefined;
		this.indices.set(id, index);
		const mount = {
			id,
			index,
			name,
			spell,
			icon,
			usable,
			collected,
			favourite,
			expansionId: getMountExpansion(id),
		};
		this.items?.put(String(id), mount);
		return mount;
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
		const saved = this.snapshots?.peek("snapshot");
		if (saved) {
			this.load(() => {});
			return saved.mounts;
		}
		const mounts: Mount[] = [];
		const count = C_MountJournal.GetNumDisplayedMounts();
		for (let index = 1; index <= count; index++) {
			const mount = this.getDisplayedMount(index);
			if (mount) mounts.push(mount);
		}
		return mounts;
	}
	getCount() {
		const saved = this.snapshots?.peek("snapshot");
		if (saved) return saved.count;
		// The generated scalar annotation omits the API's returned Lua table.
		const ids = C_MountJournal.GetMountIDs() as unknown as number[];
		let total = 0;
		let collected = 0;
		for (const id of ids) {
			const [, , , , , , , , , hidden, owned] =
				C_MountJournal.GetMountInfoByID(id);
			if (!hidden) {
				total++;
				if (owned) collected++;
			}
		}
		return { collected, total };
	}
	search(text: string): void {
		this.invalidate();
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
		this.invalidate();
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
				this.invalidate(id);
				this.displayRevision++;
				C_MountJournal.SetIsFavorite(index, favourite);
			}
			onResult(allowed);
		};
		const cached = this.indices.get(id);
		if (
			cached !== undefined &&
			C_MountJournal.GetDisplayedMountID(cached) === id
		) {
			apply(cached);
			return;
		}
		// Favouriting can reorder Blizzard's displayed indices. Resolve IDs only,
		// in bounded batches, rather than rebuilding mount data and collection counts.
		const count = C_MountJournal.GetNumDisplayedMounts();
		let index = 1;
		const step = () => {
			const end = Math.min(count, index + 19);
			while (index <= end) {
				const current = index++;
				const displayedId = C_MountJournal.GetDisplayedMountID(current);
				this.indices.set(displayedId, current);
				if (displayedId === id) {
					apply(current);
					return;
				}
			}
			if (index <= count) this.scheduler.nextFrame(step);
			else onResult(false);
		};
		this.scheduler.nextFrame(step);
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
