import { expect, it, vi } from "vitest";
import type { Currency, ICurrencyClient } from "../../clients/currency-client";
import type { ModalOption } from "../../ui/components/modal";
import { CurrencyOptions } from "./currency-options";

it("offers watch and inactive actions, and confirms source and transfer cost before submission", () => {
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, rows: readonly ModalOption[]) => {
			options = rows;
		}),
		close: vi.fn(),
	};
	const client: ICurrencyClient = {
		getCurrencies: () => [],
		load: vi.fn(),
		toggleHeader: vi.fn(),
		setWatched: vi.fn(() => true),
		setUnused: vi.fn(),
		requestSources: vi.fn(),
		sourcesReady: () => true,
		getSources: () => [{ guid: "alt", name: "Alt-Realm", maximum: 50 }],
		transferCost: () => 60,
		transfer: vi.fn(() => true),
	};
	const currency = {
		id: 42,
		name: "Marks",
		quantity: 125,
		maximum: 500,
		discovered: true,
		transferable: true,
	} as Currency;
	const refresh = vi.fn();
	const menu = new CurrencyOptions(modal, client, refresh);
	menu.open(currency);
	expect(modal.open).toHaveBeenCalledWith(
		"Marks • 125 / 500",
		expect.any(Array),
		undefined,
		"left",
	);
	expect(options.map((option) => option.label)).toEqual([
		"|A:bags-icon-multiple:18:18|a Watch in backpack",
		"|A:common-icon-redx:18:18|a Mark inactive",
		"|A:warbands-transferable-icon:18:18|a Transfer from another character…",
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	]);
	options.find((option) => option.id === "watch")?.select();
	expect(client.setWatched).toHaveBeenCalledWith(42, true);
	expect(refresh).toHaveBeenCalled();
	menu.open(currency);
	options.find((option) => option.id === "transfer")?.select();
	expect(options.at(0)?.label).toBe(
		"|A:warbands-transferable-icon:18:18|a Alt-Realm • Up to 50",
	);
	options.find((option) => option.id === "alt")?.select();
	expect(options.find((option) => option.id === "amount-50")?.label).toBe(
		"|A:warbands-transferable-icon:18:18|a 50 (maximum)",
	);
	options.find((option) => option.id === "amount-50")?.select();
	expect(modal.open.mock.lastCall?.at(0)).toContain("Receive 50 • Costs 60");
	expect(client.transfer).not.toHaveBeenCalled();
	expect(options.find((option) => option.id === "confirm")?.label).toBe(
		"|A:common-dropdown-icon-checkmark-yellow:18:18|a Confirm transfer",
	);
	options.find((option) => option.id === "confirm")?.select();
	expect(client.transfer).toHaveBeenCalledWith(42, "alt", 50);
	menu.transferResult(false);
	expect(modal.open.mock.lastCall?.at(0)).toContain("Transfer failed");
	expect(options.at(0)?.label).toBe(
		"|A:lootroll-toast-icon-pass-up:18:18|a Close",
	);
	menu.open({ ...currency, watched: true, unused: true });
	expect(options.at(0)?.label).toBe(
		"|A:common-icon-redx:18:18|a Unwatch in backpack",
	);
	expect(options.at(1)?.label).toBe(
		"|A:common-dropdown-icon-checkmark-yellow:18:18|a Mark active",
	);
	client.sourcesReady = () => false;
	options.find((option) => option.id === "transfer")?.select();
	expect(options.at(0)?.label).toBe("|A:common-icon-undo:18:18|a Check again");
	expect(options.at(1)?.label).toBe(
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	);
	client.sourcesReady = () => true;
	client.getSources = () =>
		Array.from({ length: 8 }, (_, index) => ({
			guid: `alt-${index}`,
			name: `Alt ${index}`,
			maximum: 50,
		}));
	options.at(0)?.select();
	expect(options.find((option) => option.id === "next")?.label).toBe(
		"|TInterface\\Buttons\\UI-SpellbookIcon-NextPage-Up:18:18|t More characters",
	);
	options.find((option) => option.id === "next")?.select();
	expect(options.find((option) => option.id === "previous")?.label).toBe(
		"|TInterface\\Buttons\\UI-SpellbookIcon-PrevPage-Up:18:18|t Previous characters",
	);
});
