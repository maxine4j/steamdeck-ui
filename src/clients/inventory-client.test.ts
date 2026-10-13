import { afterEach, expect, it, vi } from "vitest";
import { InventoryClient } from "./inventory-client";

afterEach(() => vi.unstubAllGlobals());

it("deposits carried stacks into the selected bank type and returns to normal use when banking ends", () => {
	let type: number | undefined = 2;
	let usable = true;
	vi.stubGlobal("C_Bank", { CanUseBank: () => usable });
	const use = vi.fn();
	vi.stubGlobal("C_Container", {
		GetContainerItemInfo: () => ({ itemID: 42, isLocked: false }),
		UseContainerItem: use,
	});
	const client = new InventoryClient({ getDepositBankType: () => type });
	const item = { bagId: 0, slotId: 1, itemId: 42 };
	client.useItem(item);
	expect(use).toHaveBeenLastCalledWith(0, 1, undefined, 2);
	type = 0;
	client.useItem(item);
	expect(use).toHaveBeenLastCalledWith(0, 1, undefined, 0);
	usable = false;
	client.useItem(item);
	expect(use).toHaveBeenCalledTimes(2);
	type = undefined;
	client.useItem(item);
	expect(use).toHaveBeenLastCalledWith(0, 1);
});

it("destroys only the selected current stack, rejecting occupied cursors, stale slots and combat", () => {
	let combat = false;
	let occupied = false;
	const info = vi.fn(() => ({ itemID: 42, isLocked: false }));
	const pickup = vi.fn(() => {
		occupied = true;
	});
	const remove = vi.fn();
	vi.stubGlobal("InCombatLockdown", () => combat);
	vi.stubGlobal("CursorHasItem", () => occupied);
	vi.stubGlobal("DeleteCursorItem", remove);
	vi.stubGlobal("C_Container", {
		GetContainerItemInfo: info,
		PickupContainerItem: pickup,
	});
	const client = new InventoryClient();
	const item = { bagId: 0, slotId: 1, itemId: 42 };
	occupied = true;
	client.destroyItem(item);
	occupied = false;
	combat = true;
	client.destroyItem(item);
	combat = false;
	info.mockReturnValue({ itemID: 43, isLocked: false });
	client.destroyItem(item);
	expect(pickup).not.toHaveBeenCalled();
	info.mockReturnValue({ itemID: 42, isLocked: false });
	client.destroyItem(item);
	expect(pickup).toHaveBeenCalledExactlyOnceWith(0, 1);
	expect(remove).toHaveBeenCalledOnce();
});

it("uses and picks up one real stack, leaving world deletion to the native cursor", () => {
	const use = vi.fn();
	const pickup = vi.fn();
	const info = vi.fn(() => ({
		itemID: 42,
		hyperlink: "item:42",
		isLocked: false,
	}));
	vi.stubGlobal("C_Container", {
		GetContainerItemInfo: info,
		UseContainerItem: use,
		PickupContainerItem: pickup,
	});
	const cursor = vi.fn(() => false);
	vi.stubGlobal("CursorHasItem", cursor);
	const deleteCursor = vi.fn();
	vi.stubGlobal("DeleteCursorItem", deleteCursor);
	const item = { bagId: 5, slotId: 3, itemId: 42, hyperlink: "item:42" };
	const client = new InventoryClient();
	client.useItem(item);
	client.pickupItem(item);
	expect(use).toHaveBeenCalledExactlyOnceWith(5, 3);
	expect(pickup).toHaveBeenCalledExactlyOnceWith(5, 3);
	expect(deleteCursor).not.toHaveBeenCalled();
	cursor.mockReturnValue(true);
	client.pickupItem(item);
	info.mockReturnValue({ itemID: 43, hyperlink: "item:43", isLocked: false });
	client.useItem(item);
	cursor.mockReturnValue(false);
	client.pickupItem(item);
	info.mockReturnValue({ itemID: 42, hyperlink: "item:42", isLocked: true });
	client.useItem(item);
	client.pickupItem(item);
	expect(use).toHaveBeenCalledOnce();
	expect(pickup).toHaveBeenCalledOnce();
});

it("reports any open carried bag, including the reagent bag, and excludes banks", () => {
	const isBagOpen = vi.fn((bagId: number) => bagId === 5);
	vi.stubGlobal("IsBagOpen", isBagOpen);
	const client = new InventoryClient();
	expect(client.isOpen()).toBe(true);
	expect(isBagOpen.mock.calls.map((call) => call.at(0))).toEqual([
		0, 1, 2, 3, 4, 5,
	]);
	isBagOpen.mockReturnValue(false);
	expect(client.isOpen()).toBe(false);
});

it("combines occupied backpack, equipped bag, and reagent slots without bag items or bank slots", () => {
	const getContainerNumSlots = vi.fn(() => 2);
	const getContainerItemInfo = vi.fn((bagId: number, slotId: number) =>
		slotId === 2
			? {
					itemID: bagId + 10,
					iconFileID: bagId + 100,
					stackCount: 200,
					quality: 1,
				}
			: undefined,
	);
	vi.stubGlobal("C_Container", {
		GetContainerNumSlots: getContainerNumSlots,
		GetContainerItemInfo: getContainerItemInfo,
	});
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
		GetItemInfoInstant: () => [10, "", "", "", 100, 7, 0],
	});
	const client = new InventoryClient();
	expect(client.getItems()).toEqual(
		[0, 1, 2, 3, 4, 5].map((bagId) => ({
			bagId,
			slotId: 2,
			itemId: bagId + 10,
			iconFileId: bagId + 100,
			count: 200,
			quality: 1,
			category: "Reagents",
			expansionId: 10,
			itemLevel: undefined,
			stackable: true,
			hyperlink: undefined,
		})),
	);
	expect(getContainerNumSlots.mock.calls.map((call) => call.at(0))).toEqual([
		0, 1, 2, 3, 4, 5,
	]);
});

it("uses the gear instance link for level and excludes bags and consumables from level labels", () => {
	vi.stubGlobal("C_Container", {
		GetContainerNumSlots: (bag: number) => (bag === 0 ? 4 : 0),
		GetContainerItemInfo: (_bag: number, slot: number) => ({
			itemID: slot,
			iconFileID: 100,
			stackCount: 1,
			quality: slot === 4 ? 0 : 4,
			hyperlink: `item:${slot}:bonus`,
		}),
	});
	const level = vi.fn(() => [150, false, 100]);
	vi.stubGlobal("C_Item", {
		GetItemInfo: () => [
			"Item",
			"",
			4,
			1,
			0,
			"",
			"",
			1,
			"",
			0,
			0,
			0,
			0,
			0,
			10,
			undefined,
			false,
		],
		GetItemInfoInstant: (id: number) => [
			id,
			"",
			"",
			id === 1 || id === 4 ? "INVTYPE_CHEST" : id === 2 ? "INVTYPE_BAG" : "",
			100,
			id === 3 ? 0 : 4,
			0,
		],
		GetDetailedItemLevelInfo: level,
	});
	const items = new InventoryClient().getItems();
	expect(items.map((item) => item.category)).toEqual([
		"Equipment",
		"Miscellaneous",
		"Consumables",
		"Junk",
	]);
	expect(items.map((item) => item.itemLevel)).toEqual([
		150,
		undefined,
		undefined,
		150,
	]);
	expect(level).toHaveBeenCalledWith("item:1:bonus");
	expect(level).toHaveBeenCalledTimes(2);
});

it("classifies cold-cache items from instant info, requests data once, and enriches after loading", () => {
	vi.stubGlobal("C_Container", {
		GetContainerNumSlots: (bag: number) => (bag === 5 ? 1 : 0),
		GetContainerItemInfo: () => ({
			itemID: 42,
			iconFileID: 100,
			stackCount: 53,
			quality: 1,
		}),
	});
	const info = vi.fn((): unknown[] => []);
	const request = vi.fn();
	vi.stubGlobal("C_Item", {
		GetItemInfo: info,
		GetItemInfoInstant: () => [42, "", "", "", 100, 7, 0],
		RequestLoadItemDataByID: request,
	});
	const client = new InventoryClient();
	expect(client.getItems().at(0)).toMatchObject({
		category: "Reagents",
		expansionId: undefined,
		stackable: false,
	});
	client.getItems();
	expect(request).toHaveBeenCalledExactlyOnceWith(42);
	info.mockReturnValue([
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
	]);
	expect(client.getItems().at(0)).toMatchObject({
		category: "Reagents",
		expansionId: 10,
		stackable: true,
	});
});

it("reads player money in copper", () => {
	vi.stubGlobal("GetMoney", () => 123456789);
	expect(new InventoryClient().getMoney()).toBe(123456789);
});
