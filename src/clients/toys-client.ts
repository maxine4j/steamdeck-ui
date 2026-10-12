import type { ITaskScheduler } from "./task-scheduler";

// Legacy toy APIs are absent from the generated Retail declarations.
declare global {
	namespace C_ToyBox {
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
export interface IToysClient {
	load(callback: (toys: Toy[]) => void): () => void;
	toggleFavourite(id: number): void;
	canUse(id: number): boolean;
}

export class ToysClient implements IToysClient {
	private readonly requestedItems = new Set<number>();
	constructor(private readonly scheduler: ITaskScheduler) {}
	load(callback: (toys: Toy[]) => void): () => void {
		const toys: Toy[] = [];
		let index = 1;
		let count: number | undefined;
		let cancelled = false;
		const step = () => {
			if (cancelled) return;
			count ??= C_ToyBox.GetNumFilteredToys();
			const end = Math.min(count, index + 19);
			while (index <= end) {
				const id = C_ToyBox.GetToyFromIndex(index++);
				if (id <= 0) continue;
				const [itemId, name, icon, favourite] = C_ToyBox.GetToyInfo(id);
				if (itemId === undefined || name === undefined) continue;
				const [itemName, , , , , , , , , , , , , , expansionId] =
					C_Item.GetItemInfo(id);
				const loaded = itemName !== undefined && itemName !== "";
				if (!loaded && !this.requestedItems.has(id)) {
					this.requestedItems.add(id);
					C_Item.RequestLoadItemDataByID(id);
				}
				toys.push({
					id,
					name: name || `Toy ${id}`,
					icon,
					favourite,
					collected: PlayerHasToy(id),
					expansionId: loaded ? expansionId : undefined,
				});
			}
			if (index <= count) cancel = this.scheduler.nextFrame(step);
			else callback(toys);
		};
		let cancel = this.scheduler.nextFrame(step);
		return () => {
			cancelled = true;
			cancel();
		};
	}
	toggleFavourite(id: number): void {
		if (PlayerHasToy(id))
			C_ToyBox.SetIsFavorite(id, !C_ToyBox.GetIsFavorite(id));
	}
	canUse(id: number): boolean {
		return !InCombatLockdown() && PlayerHasToy(id) && C_ToyBox.IsToyUsable(id);
	}
}
