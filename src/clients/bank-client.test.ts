import { afterEach, expect, it, vi } from "vitest";
import { BankClient } from "./bank-client";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	let usable = true;
	let money = 1000000000;
	const api = {
		CanViewBank: vi.fn(() => usable),
		CanUseBank: vi.fn(() => usable),
		FetchPurchasedBankTabIDs: vi.fn((type: number) =>
			type === 0 ? [6, 8] : [12, 16],
		),
		FetchNumPurchasedBankTabs: vi.fn(() => 2),
		FetchNextPurchasableBankTabData: vi.fn(() => ({
			tabCost: 100000,
			canAfford: true,
		})),
		CanPurchaseBankTab: vi.fn(() => true),
		PurchaseBankTab: vi.fn(),
		FetchDepositedMoney: vi.fn(() => 2000000),
		CanDepositMoney: vi.fn(() => true),
		CanWithdrawMoney: vi.fn(() => true),
		DepositMoney: vi.fn(),
		WithdrawMoney: vi.fn(),
		CloseBankFrame: vi.fn(),
	};
	vi.stubGlobal("C_Bank", api);
	vi.stubGlobal("GetMoney", () => money);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("CursorHasItem", () => false);
	const container = {
		GetContainerNumSlots: vi.fn(() => 1),
		GetContainerItemInfo: vi.fn(() => ({
			itemID: 42,
			iconFileID: 123,
			stackCount: 10,
			quality: 1,
			isLocked: false,
		})),
		UseContainerItem: vi.fn(),
		PickupContainerItem: vi.fn(),
	};
	vi.stubGlobal("C_Container", container);
	vi.stubGlobal("C_Item", {
		GetItemInfo: () => [
			"Cloth",
			"",
			1,
			1,
			0,
			"",
			"",
			1000,
			"",
			0,
			0,
			7,
			0,
			0,
			10,
			undefined,
			true,
		],
		GetItemInfoInstant: () => [42, "", "", "", 123, 7, 0],
	});
	return {
		client: new BankClient(),
		api,
		container,
		lock: () => {
			usable = false;
		},
		spend: () => {
			money = 0;
		},
	};
}

it("scans every purchased tab of only the requested bank, retaining real sources and bag classification", () => {
	const { client, container, lock } = setup();
	client.setOpen(true);
	expect(client.getItems("standard").map((item) => item.bagId)).toEqual([6, 8]);
	expect(client.getItems("warband")).toEqual(
		[12, 16].map((bagId) =>
			expect.objectContaining({
				bagId,
				slotId: 1,
				category: "Reagents",
				expansionId: 10,
				stackable: true,
			}),
		),
	);
	expect(
		container.GetContainerNumSlots.mock.calls.map((call) => call.at(0)),
	).toEqual([6, 8, 12, 16]);
	lock();
	expect(client.getItems("warband")).toEqual([]);
	client.setOpen(false);
	expect(client.getItems("standard")).toEqual([]);
});

it("reports tab capacity and gold, and rechecks cost, permissions and balance before transactions", () => {
	const { client, api, spend, lock } = setup();
	client.setOpen(true);
	expect(client.getState("standard")).toMatchObject({
		unlockedTabs: 2,
		maxTabs: 6,
		nextTabCost: 100000,
		canBuyTab: true,
	});
	expect(client.getState("warband")).toMatchObject({
		maxTabs: 5,
		money: 2000000,
		characterMoney: 1000000000,
	});
	client.purchaseTab("warband", 100000);
	expect(api.PurchaseBankTab).toHaveBeenCalledExactlyOnceWith(2);
	client.purchaseTab("warband", 99999);
	client.transferMoney("deposit", 100000);
	client.transferMoney("withdraw", 2000000);
	client.transferMoney("withdraw", 2000001);
	client.transferMoney("deposit", -1);
	client.transferMoney("deposit", 1.5);
	expect(api.DepositMoney).toHaveBeenCalledExactlyOnceWith(2, 100000);
	expect(api.WithdrawMoney).toHaveBeenCalledExactlyOnceWith(2, 2000000);
	spend();
	client.purchaseTab("warband", 100000);
	client.transferMoney("deposit", 1);
	lock();
	client.transferMoney("withdraw", 1);
	expect(api.PurchaseBankTab).toHaveBeenCalledOnce();
	expect(api.DepositMoney).toHaveBeenCalledOnce();
	expect(api.WithdrawMoney).toHaveBeenCalledOnce();
});

it("withdraws one physical stack and rejects locked, stale, closed or foreign slots", () => {
	const { client, container, lock } = setup();
	const item = { bagId: 12, slotId: 1, itemId: 42 };
	client.useItem(item);
	client.setOpen(true);
	client.useItem(item);
	client.pickupItem(item);
	expect(container.UseContainerItem).toHaveBeenCalledExactlyOnceWith(12, 1);
	expect(container.PickupContainerItem).toHaveBeenCalledExactlyOnceWith(12, 1);
	client.useItem({ ...item, itemId: 43 });
	client.useItem({ ...item, bagId: 0 });
	lock();
	client.useItem(item);
	expect(container.UseContainerItem).toHaveBeenCalledOnce();
	client.close();
});

it("closes an active bank once and ignores closure caused by native BANKFRAME_CLOSED", () => {
	const { client, api } = setup();
	client.close();
	expect(api.CloseBankFrame).not.toHaveBeenCalled();
	client.setOpen(true);
	client.close();
	expect(api.CloseBankFrame).toHaveBeenCalledOnce();
	client.setOpen(false);
	client.close();
	expect(api.CloseBankFrame).toHaveBeenCalledOnce();
});
