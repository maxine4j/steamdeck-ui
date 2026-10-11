import { afterEach, expect, it, vi } from "vitest";
import { InventoryClient } from "./inventory-client";

afterEach(() => vi.unstubAllGlobals());

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
