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
		slotId === 2 ? { itemID: bagId + 10, iconFileID: bagId + 100 } : undefined,
	);
	vi.stubGlobal("C_Container", {
		GetContainerNumSlots: getContainerNumSlots,
		GetContainerItemInfo: getContainerItemInfo,
	});
	const client = new InventoryClient();
	expect(client.getItems()).toEqual(
		[0, 1, 2, 3, 4, 5].map((bagId) => ({
			bagId,
			slotId: 2,
			itemId: bagId + 10,
			iconFileId: bagId + 100,
		})),
	);
	expect(getContainerNumSlots.mock.calls.map((call) => call.at(0))).toEqual([
		0, 1, 2, 3, 4, 5,
	]);
});
