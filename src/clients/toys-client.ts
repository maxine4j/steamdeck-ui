import { type IJournalPrefetch, JournalPrefetch } from "./journal-prefetch";
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
export interface IToysClient extends IJournalPrefetch {
	isInCombat(): boolean;
	load(
		callback: (toys: Toy[]) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void;
	toggleFavourite(id: number): void;
	canUse(id: number): boolean;
	getCooldown(id: number): { start: number; duration: number };
}

export class ToysClient implements IToysClient {
	private readonly requestedItems = new Set<number>();
	private readonly journal: JournalPrefetch<Toy[]>;
	constructor(private readonly scheduler: ITaskScheduler) {
		this.journal = new JournalPrefetch(scheduler, (done, _preview, progress) =>
			this.scan(done, progress),
		);
	}
	prefetch(): void {
		this.journal.prefetch();
	}
	invalidate(): void {
		this.journal.invalidate();
	}
	stop(): void {
		this.journal.stop();
	}
	load(
		callback: (toys: Toy[]) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void {
		return this.journal.load(callback, undefined, onProgress);
	}
	private scan(
		callback: (toys: Toy[]) => void,
		onProgress?: (completed: number, total: number) => void,
	): () => void {
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
				if (itemId === undefined) continue;
				const [itemName, , , , , , , , , , , , , , expansionId] =
					C_Item.GetItemInfo(id);
				const loaded = itemName !== undefined && itemName !== "";
				if (!loaded && !this.requestedItems.has(id)) {
					this.requestedItems.add(id);
					C_Item.RequestLoadItemDataByID(id);
				}
				toys.push({
					id,
					// Startup prefetch can precede name caching. Keep the entry;
					// item-data events invalidate the snapshot when metadata arrives.
					name: name || itemName || `Toy ${id}`,
					icon,
					favourite,
					collected: PlayerHasToy(id),
					expansionId: loaded ? expansionId : undefined,
				});
			}
			onProgress?.(Math.min(count, index - 1), count);
			if (cancelled) return;
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
		if (PlayerHasToy(id)) {
			this.invalidate();
			C_ToyBox.SetIsFavorite(id, !C_ToyBox.GetIsFavorite(id));
		}
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
