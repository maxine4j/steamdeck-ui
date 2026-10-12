import { afterEach, expect, it, vi } from "vitest";
import { CurrencyClient } from "./currency-client";

afterEach(() => vi.unstubAllGlobals());
const pending: (() => void)[] = [];
const scheduler = {
	nextFrame: (callback: () => void) => {
		let cancelled = false;
		pending.push(() => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	},
};
function setup() {
	const rows = [
		{
			name: "Expansion",
			isHeader: true,
			isHeaderExpanded: true,
			currencyListDepth: 0,
		},
		{
			name: "Marks",
			currencyID: 42,
			iconFileID: 123,
			quantity: 20,
			discovered: true,
			currencyListDepth: 1,
			maxQuantity: 100,
			maxWeeklyQuantity: 30,
			quantityEarnedThisWeek: 25,
		},
	];
	const api = {
		GetCurrencyListSize: vi.fn(() => rows.length),
		GetCurrencyListInfo: (index: number) => rows.at(index - 1),
		GetCurrencyInfo: () => rows.at(1),
		ExpandCurrencyList: vi.fn(),
		SetCurrencyBackpackByID: vi.fn(),
		SetCurrencyUnused: vi.fn(),
		GetBackpackCurrencyInfo: () => undefined,
		RequestCurrencyDataForAccountCharacters: vi.fn(),
		IsAccountCharacterCurrencyDataReady: () => true,
		IsCurrencyTransferInProgress: () => false,
		CanTransferCurrency: () => [true, undefined],
		IsAccountTransferableCurrency: () => true,
		FetchCurrencyDataFromAccountCharacters: () => [
			{
				characterGUID: "Player-other",
				fullCharacterName: "Alt-Realm",
				quantity: 100,
			},
		],
		GetMaxTransferableAmountFromQuantity: () => 80,
		GetCostToTransferCurrency: (_id: number, amount: number) => amount + 2,
		RequestCurrencyFromAccountCharacter: vi.fn(),
	};
	vi.stubGlobal("C_CurrencyInfo", api);
	vi.stubGlobal("BackpackTokenFrame", { GetMaxTokensWatched: () => 3 });
	return api;
}
it("preserves category depth, icons and stable currency IDs", () => {
	setup();
	expect(new CurrencyClient(scheduler).getCurrencies()).toMatchObject([
		{ name: "Expansion", header: true, depth: 0, expanded: true },
		{ id: 42, icon: 123, depth: 1, quantity: 20 },
	]);
});
it("caps transfers against source balance, weekly and total limits and revalidates submission", () => {
	const api = setup();
	const client = new CurrencyClient(scheduler);
	expect(client.getSources(42)).toEqual([
		{ guid: "Player-other", name: "Alt-Realm", maximum: 5 },
	]);
	expect(client.transfer(42, "Player-other", 6)).toBe(false);
	expect(client.transfer(42, "Player-other", 5)).toBe(true);
	expect(api.RequestCurrencyFromAccountCharacter).toHaveBeenCalledWith(
		"Player-other",
		42,
		5,
	);
	api.IsCurrencyTransferInProgress = () => true;
	expect(client.transfer(42, "Player-other", 1)).toBe(false);
});
it("refuses new watches when all backpack slots are occupied", () => {
	const api = setup();
	api.GetBackpackCurrencyInfo = vi.fn(() => ({
		currencyTypesID: 9,
	})) as unknown as typeof api.GetBackpackCurrencyInfo;
	expect(new CurrencyClient(scheduler).setWatched(42, true)).toBe(false);
	expect(api.SetCurrencyBackpackByID).not.toHaveBeenCalled();
});

it("reads size once and bounds enumeration to twenty lookups per frame, cancelling the latest continuation", () => {
	pending.length = 0;
	const api = setup();
	api.GetCurrencyListSize.mockReturnValue(55);
	const lookup = vi.fn(api.GetCurrencyListInfo);
	api.GetCurrencyListInfo = lookup;
	const complete = vi.fn();
	const cancel = new CurrencyClient(scheduler).load(complete);
	expect(lookup).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(lookup).toHaveBeenCalledTimes(20);
	pending.shift()?.();
	expect(lookup).toHaveBeenCalledTimes(40);
	expect(api.GetCurrencyListSize).toHaveBeenCalledOnce();
	cancel();
	pending.shift()?.();
	expect(lookup).toHaveBeenCalledTimes(40);
	expect(complete).not.toHaveBeenCalled();
	new CurrencyClient(scheduler).load(complete);
	while (pending.length) pending.shift()?.();
	expect(lookup).toHaveBeenCalledTimes(95);
	expect(complete).toHaveBeenCalledOnce();
});
