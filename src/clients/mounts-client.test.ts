import { afterEach, expect, it, vi } from "vitest";
import { MountsClient } from "./mounts-client";

afterEach(() => vi.unstubAllGlobals());
it("routes search and each filter group to the journal and retains the equipment confirmation flow", () => {
	const collection = vi.fn();
	const type = vi.fn();
	const source = vi.fn();
	const search = vi.fn();
	vi.stubGlobal("C_MountJournal", {
		GetCollectedFilterSetting: () => true,
		IsValidTypeFilter: () => true,
		IsTypeChecked: () => false,
		IsValidSourceFilter: () => true,
		IsSourceChecked: () => true,
		SetCollectedFilterSetting: collection,
		SetTypeFilter: type,
		SetSourceFilter: source,
		SetSearch: search,
	});
	vi.stubGlobal("C_PetJournal", { GetNumPetSources: () => 12 });
	const client = new MountsClient();
	client.search("horse");
	client.toggleFilter("collection:2");
	client.toggleFilter("type:3");
	client.toggleFilter("source:12");
	client.toggleFilter("source:999");
	expect(search).toHaveBeenCalledWith("horse");
	expect(collection).toHaveBeenCalledWith(2, false);
	expect(type).toHaveBeenCalledWith(3, true);
	expect(source).toHaveBeenCalledExactlyOnceWith(12, false);
	const apply = vi.fn();
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("C_Cursor", { GetCursorItem: () => undefined });
	vi.stubGlobal("MountJournal", {
		BottomLeftInset: { SlotButton: { ApplyEquipmentAtCursor: apply } },
	});
	client.applyEquipment();
	expect(apply).not.toHaveBeenCalled();
	vi.stubGlobal("C_Cursor", { GetCursorItem: () => ({ bag: 0, slot: 1 }) });
	client.applyEquipment();
	expect(apply).toHaveBeenCalledOnce();
});
it("uses displayed indices for favourites, preserves mount IDs and counts the full collection", () => {
	const favourite = vi.fn();
	vi.stubGlobal("C_MountJournal", {
		GetMountIDs: () => [10, 20, 30],
		GetMountInfoByID: (id: number) => [
			"Mount",
			1,
			2,
			false,
			true,
			1,
			false,
			false,
			null,
			id === 30,
			id === 10,
		],
		GetNumDisplayedMounts: () => 1,
		GetDisplayedMountInfo: () => [
			"Horse",
			123,
			456,
			false,
			true,
			1,
			true,
			false,
			null,
			false,
			true,
			20,
		],
		GetIsFavorite: () => [true, true],
		SetIsFavorite: favourite,
	});
	const client = new MountsClient();
	expect(client.getCount()).toEqual({ collected: 1, total: 2 });
	expect(client.getMounts()).toEqual([
		{
			id: 20,
			index: 1,
			name: "Horse",
			spell: 123,
			icon: 456,
			collected: true,
			usable: true,
			favourite: true,
		},
	]);
	client.toggleFavourite(20);
	expect(favourite).toHaveBeenCalledWith(1, false);
	client.toggleFavourite(999);
	expect(favourite).toHaveBeenCalledTimes(1);
});
