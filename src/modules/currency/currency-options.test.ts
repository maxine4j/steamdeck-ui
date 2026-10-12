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
		discovered: true,
		transferable: true,
	} as Currency;
	const refresh = vi.fn();
	const menu = new CurrencyOptions(modal, client, refresh);
	menu.open(currency);
	expect(options.map((option) => option.label)).toEqual([
		"Watch in backpack",
		"Mark inactive",
		"Transfer from another character…",
		"Cancel",
	]);
	options.find((option) => option.id === "watch")?.select();
	expect(client.setWatched).toHaveBeenCalledWith(42, true);
	expect(refresh).toHaveBeenCalled();
	menu.open(currency);
	options.find((option) => option.id === "transfer")?.select();
	options.find((option) => option.id === "alt")?.select();
	options.find((option) => option.id === "amount-50")?.select();
	expect(modal.open.mock.lastCall?.at(0)).toContain("Receive 50 • Costs 60");
	expect(client.transfer).not.toHaveBeenCalled();
	options.find((option) => option.id === "confirm")?.select();
	expect(client.transfer).toHaveBeenCalledWith(42, "alt", 50);
	menu.transferResult(false);
	expect(modal.open.mock.lastCall?.at(0)).toContain("Transfer failed");
});
