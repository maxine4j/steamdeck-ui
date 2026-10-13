import { expect, it, vi } from "vitest";
import type { IBankClient } from "../../clients/bank-client";
import type { ModalOption } from "../../ui/components/modal";
import { ItemGrouping } from "../bags/item-grouping";
import { BankOptions } from "./bank-options";

it("shares grouping changes immediately and allows views to unsubscribe", () => {
	const grouping = new ItemGrouping();
	const bags = vi.fn();
	const bank = vi.fn();
	grouping.subscribe(bags);
	const unsubscribe = grouping.subscribe(bank);
	grouping.toggle();
	expect(grouping.mode).toBe("expansion");
	expect(bags).toHaveBeenCalledOnce();
	expect(bank).toHaveBeenCalledOnce();
	unsubscribe();
	grouping.toggle();
	expect(grouping.mode).toBe("category");
	expect(bags).toHaveBeenCalledTimes(2);
	expect(bank).toHaveBeenCalledOnce();
});

function setup(gold = 1000000) {
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, choices: readonly ModalOption[]) => {
			options = choices;
		}),
		close: vi.fn(),
	};
	const state = {
		available: true,
		unlockedTabs: 2,
		maxTabs: 5,
		nextTabCost: 100000000,
		canBuyTab: true,
		money: 600000 * 10000,
		characterMoney: gold * 10000,
		canDeposit: true,
		canWithdraw: true,
	};
	const client: IBankClient = {
		getState: () => state,
		getItems: () => [],
		setOpen: vi.fn(),
		select: vi.fn(),
		getDepositBankType: () => undefined,
		purchaseTab: vi.fn(),
		transferMoney: vi.fn(),
		close: vi.fn(),
		useItem: vi.fn(),
		pickupItem: vi.fn(),
	};
	return {
		menu: new BankOptions(modal, client),
		modal,
		client,
		state,
		choices: () => options,
	};
}

it("confirms the next tab cost and never buys on cancel or when unavailable", () => {
	const { menu, client, choices, state, modal } = setup();
	menu.purchase("warband");
	expect(modal.open).toHaveBeenCalled();
	expect(client.purchaseTab).not.toHaveBeenCalled();
	choices()
		.find((option) => option.id === "cancel")
		?.select();
	expect(client.purchaseTab).not.toHaveBeenCalled();
	menu.purchase("warband");
	choices()
		.find((option) => option.id === "confirm")
		?.select();
	expect(client.purchaseTab).toHaveBeenCalledExactlyOnceWith(
		"warband",
		100000000,
	);
	state.canBuyTab = false;
	modal.open.mockClear();
	menu.purchase("warband");
	expect(modal.open).not.toHaveBeenCalled();
});

it.each([1000000, 12345, 1200, 12, 0.01])(
	"offers three affordable increasing presets for %s gold, plus reserve and all",
	(gold) => {
		const { menu, client, choices } = setup(gold);
		menu.transfer("deposit");
		const options = choices();
		expect(options.slice(0, 3).map((option) => option.id)).toEqual([
			"amount-0",
			"amount-1",
			"amount-2",
		]);
		for (const option of options.slice(0, 3)) option.select();
		const amounts = vi
			.mocked(client.transferMoney)
			.mock.calls.map((call) => call.at(1) as number);
		expect(amounts).toHaveLength(3);
		expect(
			amounts.every((amount) => amount > 0 && amount <= gold * 10000),
		).toBe(true);
		expect(amounts.at(0)).toBeLessThan(amounts.at(1) as number);
		expect(amounts.at(1)).toBeLessThan(amounts.at(2) as number);
		if (gold === 1000000)
			expect(amounts).toEqual(
				[10000, 100000, 500000].map((amount) => amount * 10000),
			);
		expect(
			options.find((option) => option.id === "reserve") !== undefined,
		).toBe(gold > 100000);
		options.find((option) => option.id === "all")?.select();
		expect(client.transferMoney).toHaveBeenLastCalledWith(
			"deposit",
			gold * 10000,
		);
	},
);

it("withdraws from warband funds and computes all-but-100k from that balance", () => {
	const { menu, client, choices, state } = setup(10);
	menu.transfer("withdraw");
	choices()
		.find((option) => option.id === "reserve")
		?.select();
	expect(client.transferMoney).toHaveBeenLastCalledWith(
		"withdraw",
		state.money - 100000 * 10000,
	);
	choices()
		.find((option) => option.id === "all")
		?.select();
	expect(client.transferMoney).toHaveBeenLastCalledWith(
		"withdraw",
		state.money,
	);
	state.canWithdraw = false;
	vi.mocked(client.transferMoney).mockClear();
	menu.transfer("withdraw");
	expect(client.transferMoney).not.toHaveBeenCalled();
});
