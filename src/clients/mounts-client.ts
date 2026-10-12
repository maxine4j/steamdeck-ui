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
}
export interface MountFilter {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
}
export interface IMountsClient {
	load(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
		) => void,
	): () => void;
	summon(id: number): void;
	pickupRandom(): void;
	getMounts(): Mount[];
	getCount(): { collected: number; total: number };
	search(text: string): void;
	getFilters(): MountFilter[];
	toggleFilter(id: string): void;
	toggleFavourite(id: number): void;
	getEquipment(): { icon: number; label: string; link?: string };
	applyEquipment(): void;
	getUtilitySpells(): { favourite: number; flight: number };
}
export class MountsClient implements IMountsClient {
	constructor(private readonly scheduler: ITaskScheduler) {}
	load(
		callback: (
			mounts: Mount[],
			count: { collected: number; total: number },
		) => void,
	): () => void {
		const mounts: Mount[] = [];
		let ids: number[] | undefined;
		let displayed = 0;
		let index = 1;
		let countIndex = 0;
		let collected = 0;
		let total = 0;
		const step = () => {
			if (!ids) {
				displayed = C_MountJournal.GetNumDisplayedMounts();
				ids = C_MountJournal.GetMountIDs() as unknown as number[];
			}
			// Bound API work per frame, including the unfiltered collection count.
			let remaining = 20;
			while (index <= displayed && remaining > 0) {
				const mount = this.getDisplayedMount(index++);
				if (mount) mounts.push(mount);
				remaining--;
			}
			while (countIndex < ids.length && remaining > 0) {
				const id = ids.at(countIndex++);
				if (id !== undefined) {
					const [, , , , , , , , , hidden, owned] =
						C_MountJournal.GetMountInfoByID(id);
					if (!hidden) {
						total++;
						if (owned) collected++;
					}
				}
				remaining--;
			}
			if (index <= displayed || countIndex < ids.length)
				cancel = this.scheduler.nextFrame(step);
			else callback(mounts, { collected, total });
		};
		let cancel = this.scheduler.nextFrame(step);
		return () => cancel();
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
		return hidden
			? undefined
			: { id, index, name, spell, icon, usable, collected, favourite };
	}
	summon(id: number): void {
		C_MountJournal.SummonByID(id);
	}
	pickupRandom(): void {
		C_MountJournal.Pickup(0);
	}
	getMounts(): Mount[] {
		const mounts: Mount[] = [];
		const count = C_MountJournal.GetNumDisplayedMounts();
		for (let index = 1; index <= count; index++) {
			const mount = this.getDisplayedMount(index);
			if (mount) mounts.push(mount);
		}
		return mounts;
	}
	getCount() {
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
	toggleFavourite(id: number): void {
		const mount = this.getMounts().find((mount) => mount.id === id);
		if (!mount) return;
		const [favourite, allowed] = C_MountJournal.GetIsFavorite(mount.index);
		if (allowed) C_MountJournal.SetIsFavorite(mount.index, !favourite);
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
