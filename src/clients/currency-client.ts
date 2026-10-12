import type { ITaskScheduler } from "./task-scheduler";

export interface Currency {
	readonly index: number;
	readonly id: number;
	readonly name: string;
	readonly description: string;
	readonly header: boolean;
	readonly expanded: boolean;
	readonly depth: number;
	readonly icon?: number;
	readonly quantity: number;
	readonly maximum: number;
	readonly watched: boolean;
	readonly unused: boolean;
	readonly discovered: boolean;
	readonly accountWide: boolean;
	readonly transferable: boolean;
}
export interface CurrencySource {
	readonly guid: string;
	readonly name: string;
	readonly maximum: number;
}
export interface ICurrencyClient {
	getCurrencies(): Currency[];
	load(callback: (currencies: Currency[]) => void): () => void;
	toggleHeader(currency: Currency): void;
	setWatched(id: number, watched: boolean): boolean;
	setUnused(id: number, unused: boolean): void;
	requestSources(): void;
	sourcesReady(): boolean;
	getSources(id: number): CurrencySource[];
	transferCost(id: number, amount: number): number | undefined;
	transfer(id: number, guid: string, amount: number): boolean;
}
// Generated table returns are flattened and field acronyms normalized.
type NativeCurrency = Omit<CurrencyInfo, "currencyId" | "iconFileId"> & {
	currencyID: number;
	iconFileID: number;
};
const infoAt = (index: number) =>
	(
		C_CurrencyInfo.GetCurrencyListInfo as unknown as (
			this: void,
			index: number,
		) => NativeCurrency | undefined
	)(index);
const infoFor = (id: number) =>
	(
		C_CurrencyInfo.GetCurrencyInfo as unknown as (
			this: void,
			id: number,
		) => NativeCurrency | undefined
	)(id);
export class CurrencyClient implements ICurrencyClient {
	constructor(private readonly scheduler: ITaskScheduler) {}
	load(callback: (currencies: Currency[]) => void): () => void {
		const rows: Currency[] = [];
		let index = 1;
		let count: number | undefined;
		let cancelled = false;
		const step = () => {
			if (cancelled) return;
			count ??= C_CurrencyInfo.GetCurrencyListSize();
			const end = Math.min(count, index + 19);
			while (index <= end) {
				const row = this.currencyAt(index++);
				if (row) rows.push(row);
			}
			if (index <= count) cancel = this.scheduler.nextFrame(step);
			else callback(rows);
		};
		let cancel = this.scheduler.nextFrame(step);
		return () => {
			cancelled = true;
			cancel();
		};
	}
	getCurrencies(): Currency[] {
		const rows: Currency[] = [];
		const count = C_CurrencyInfo.GetCurrencyListSize();
		for (let index = 1; index <= count; index++) {
			const row = this.currencyAt(index);
			if (row) rows.push(row);
		}
		return rows;
	}
	private currencyAt(index: number): Currency | undefined {
		const data = infoAt(index);
		if (!data) return undefined;
		return {
			index,
			id: data.currencyID ?? 0,
			name: data.name,
			description: data.description ?? "",
			header: !!data.isHeader,
			expanded: !!data.isHeaderExpanded,
			depth: data.currencyListDepth ?? 0,
			icon: data.isHeader ? undefined : data.iconFileID,
			quantity: data.quantity ?? 0,
			maximum: data.maxQuantity ?? 0,
			watched: !!data.isShowInBackpack,
			unused: !!data.isTypeUnused,
			discovered: !!data.discovered,
			accountWide: !!data.isAccountWide,
			transferable: !!data.isAccountTransferable,
		};
	}
	toggleHeader(currency: Currency): void {
		C_CurrencyInfo.ExpandCurrencyList(currency.index, !currency.expanded);
	}
	setWatched(id: number, watched: boolean): boolean {
		const currency = infoFor(id);
		if (!currency?.discovered) return false;
		if (watched && !currency.isShowInBackpack) {
			let occupied = 0;
			const maximum = BackpackTokenFrame.GetMaxTokensWatched();
			for (let index = 1; index <= maximum; index++)
				if (
					(C_CurrencyInfo.GetBackpackCurrencyInfo(index) as unknown) !==
					undefined
				)
					occupied++;
			if (occupied >= maximum) return false;
		}
		C_CurrencyInfo.SetCurrencyBackpackByID(id, watched);
		return true;
	}
	setUnused(id: number, unused: boolean): void {
		const count = C_CurrencyInfo.GetCurrencyListSize();
		for (let index = 1; index <= count; index++) {
			const currency = infoAt(index);
			if (currency && !currency.isHeader && currency.currencyID === id) {
				C_CurrencyInfo.SetCurrencyUnused(index, unused);
				return;
			}
		}
	}
	requestSources(): void {
		C_CurrencyInfo.RequestCurrencyDataForAccountCharacters();
	}
	sourcesReady(): boolean {
		return C_CurrencyInfo.IsAccountCharacterCurrencyDataReady();
	}
	getSources(id: number): CurrencySource[] {
		const [allowed] = C_CurrencyInfo.CanTransferCurrency(id);
		if (
			!this.sourcesReady() ||
			!allowed ||
			C_CurrencyInfo.IsCurrencyTransferInProgress() ||
			!C_CurrencyInfo.IsAccountTransferableCurrency(id)
		)
			return [];
		const currency = infoFor(id);
		if (!currency) return [];
		const remaining = Math.max(
			0,
			Math.min(
				100000000 - currency.quantity,
				currency.maxQuantity > 0
					? currency.maxQuantity - currency.quantity
					: 100000000,
				currency.maxWeeklyQuantity > 0
					? currency.maxWeeklyQuantity - currency.quantityEarnedThisWeek
					: 100000000,
			),
		);
		const sources =
			(
				C_CurrencyInfo.FetchCurrencyDataFromAccountCharacters as unknown as (
					this: void,
					id: number,
				) =>
					| {
							characterGUID: string;
							fullCharacterName: string;
							quantity: number;
					  }[]
					| undefined
			)(id) ?? [];
		return sources
			.map((source) => ({
				guid: source.characterGUID,
				name: source.fullCharacterName,
				maximum: Math.floor(
					Math.min(
						remaining,
						C_CurrencyInfo.GetMaxTransferableAmountFromQuantity(
							id,
							source.quantity,
						) ?? 0,
					),
				),
			}))
			.filter((source) => source.maximum > 0);
	}
	transferCost(id: number, amount: number): number | undefined {
		return C_CurrencyInfo.GetCostToTransferCurrency(id, amount) ?? undefined;
	}
	transfer(id: number, guid: string, amount: number): boolean {
		const source = this.getSources(id).find(
			(candidate) => candidate.guid === guid,
		);
		if (
			!source ||
			amount < 1 ||
			amount !== Math.floor(amount) ||
			amount > source.maximum ||
			this.transferCost(id, amount) === undefined
		)
			return false;
		(
			C_CurrencyInfo.RequestCurrencyFromAccountCharacter as unknown as (
				this: void,
				guid: string,
				id: number,
				amount: number,
			) => void
		)(guid, id, amount);
		return true;
	}
}
