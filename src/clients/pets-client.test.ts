import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { PetsClient } from "./pets-client";

afterEach(() => vi.unstubAllGlobals());

it("loads journal source and description plus the total owned count independently of filtered copies", () => {
	const { client, api, flush } = setup(1);
	api.GetNumCollectedInfo.mockReturnValue([3, 3]);
	api.GetPetInfoByIndex.mockReturnValue([
		"Pet-1",
		39,
		true,
		undefined,
		1,
		false,
		false,
		"Cat",
		123,
		1,
		1,
		"Vendor: Cat Merchant",
		"A friendly cat.",
	]);
	const done = vi.fn();
	client.load(done);
	flush();
	expect(done.mock.lastCall?.at(0).at(0)).toMatchObject({
		source: "Vendor: Cat Merchant",
		description: "A friendly cat.",
		ownedCount: 3,
		collectionLimit: 3,
	});
});

it("searches pets from the native journal and replaces a warm snapshot", () => {
	const { client, api, flush } = setup(3);
	client.load(vi.fn());
	flush();
	const search = vi.fn();
	Object.assign(api, { SetSearchFilter: search });
	api.GetNumPets.mockReturnValue([1, 1]);
	api.GetPetInfoByIndex.mockImplementation(() => [
		"Pet-9",
		39,
		true,
		undefined,
		1,
		false,
		false,
		"Cat",
		123,
	]);
	client.search("Cat");
	const done = vi.fn();
	client.load(done);
	flush();
	expect(search).toHaveBeenLastCalledWith("Cat");
	expect(done).toHaveBeenCalledOnce();
	expect(
		done.mock.lastCall?.at(0).map((pet: { id: string }) => pet.id),
	).toEqual(["Pet-9"]);
	client.stop();
	const reopened = vi.fn();
	client.load(reopened, undefined, undefined, true);
	expect(
		reopened.mock.lastCall?.at(0).map((pet: { id: string }) => pet.id),
	).toEqual(["Pet-1", "Pet-2", "Pet-3"]);
});

it("exposes pet ownership, combat type, families and sources and toggles each native filter", () => {
	const { client, api } = setup();
	const filters = Object.assign(api, {
		IsFilterChecked: () => true,
		SetFilterChecked: vi.fn(),
		GetNumPetTypes: () => 1,
		IsPetTypeChecked: () => true,
		SetPetTypeFilter: vi.fn(),
		GetNumPetSources: () => 1,
		IsPetSourceChecked: () => false,
		SetPetSourceChecked: vi.fn(),
	});
	vi.stubGlobal("_G", {
		LE_PET_JOURNAL_FILTER_COLLECTED: 1,
		LE_PET_JOURNAL_FILTER_NOT_COLLECTED: 2,
		LE_PET_JOURNAL_FILTER_TYPE_BATTLE_PETS: 3,
		LE_PET_JOURNAL_FILTER_TYPE_NON_COMBAT_PETS: 4,
		BATTLE_PET_NAME_1: "Humanoid",
		BATTLE_PET_SOURCE_1: "Drop",
	});
	expect(client.getFilters()).toEqual([
		{ id: "collected", label: "Collected", checked: true },
		{ id: "uncollected", label: "Not collected", checked: true },
		{ id: "battle", label: "Battle pets", checked: true },
		{ id: "noncombat", label: "Non-combat pets", checked: true },
		{ id: "family:1", label: "Family: Humanoid", checked: true },
		{ id: "source:1", label: "Source: Drop", checked: false },
	]);
	client.toggleFilter("collected");
	client.toggleFilter("family:1");
	client.toggleFilter("source:1");
	client.toggleFilter("family:99");
	expect(filters.SetFilterChecked).toHaveBeenCalledWith(1, false);
	expect(filters.SetPetTypeFilter).toHaveBeenCalledExactlyOnceWith(1, false);
	expect(filters.SetPetSourceChecked).toHaveBeenCalledWith(1, true);
});
function setup(count = 45) {
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
	const api = {
		GetNumCollectedInfo: vi.fn(() => [1, 3]),
		SetDefaultFilters: vi.fn(),
		ClearSearchFilter: vi.fn(),
		GetNumPets: vi.fn(() => [count, count]),
		GetPetInfoByIndex: vi.fn((index: number) => [
			`Pet-${index}`,
			39,
			true,
			undefined,
			1,
			false,
			false,
			`Pet ${index}`,
			123,
		]),
		GetPetInfoByPetID: vi.fn(() => [
			39,
			"Renamed",
			1,
			0,
			0,
			0,
			true,
			"Cat",
			123,
		]),
		PetIsSummonable: vi.fn(() => true),
		SummonPetByGUID: vi.fn(),
		SummonRandomPet: vi.fn(),
		SetFavorite: vi.fn(),
	};
	vi.stubGlobal("C_PetJournal", api);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("SteamDeckUIConfig", {});
	const client = new PetsClient(scheduler, new CollectionCache(scheduler));
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	return {
		client,
		api,
		pending,
		flush,
	};
}

it("only rereads the event's pet during repeated targeted refreshes", () => {
	const { client, api, flush } = setup(2);
	client.load(vi.fn());
	flush();
	client.invalidate("Pet-2");
	client.load(vi.fn());
	flush();
	api.GetPetInfoByPetID.mockClear();
	client.invalidate("Pet-2");
	client.load(vi.fn());
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
});

it("keeps unowned species cached without querying them as owned GUIDs", () => {
	const { client, api, flush } = setup(2);
	api.GetPetInfoByIndex.mockImplementation((index) => [
		index === 1 ? undefined : "Pet-2",
		40,
		index !== 1,
		undefined,
		1,
		false,
		false,
		"Cat",
		123,
	]);
	client.load(vi.fn());
	flush();
	client.invalidate("Pet-2");
	client.load(vi.fn());
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
});
it("prefetches twenty pets per frame, previews early and reuses unchanged snapshots", () => {
	const { client, api, pending, flush } = setup();
	const done = vi.fn(),
		preview = vi.fn();
	client.load(done, undefined, preview);
	pending.shift()?.();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(20);
	expect(preview.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done).not.toHaveBeenCalled();
	flush();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(api.GetNumPets).toHaveBeenCalledOnce();
	client.load(done);
	flush();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(45);
	expect(api.SetDefaultFilters).toHaveBeenCalledOnce();
});
it("refreshes only a changed GUID and preserves duplicate species identities", () => {
	const { client, api, flush } = setup(2);
	const done = vi.fn();
	client.load(done);
	flush();
	client.invalidate("Pet-2");
	client.load(done);
	flush();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(2);
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
	expect(
		done.mock.lastCall?.at(0).map((pet: { id: string }) => pet.id),
	).toEqual(["Pet-1", "Pet-2"]);
	expect(done.mock.lastCall?.at(0).at(1)).toMatchObject({
		name: "Renamed",
		favourite: true,
	});
});
it("rescans membership for list changes and stops the latest continuation", () => {
	const { client, api, pending, flush } = setup();
	client.prefetch();
	pending.shift()?.();
	client.stop();
	flush();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(20);
	client.prefetch();
	flush();
	api.GetNumPets.mockReturnValue([1, 1]);
	client.invalidate();
	const done = vi.fn();
	client.load(done);
	flush();
	expect(done.mock.lastCall?.at(0)).toHaveLength(1);
});
it("summons collected GUIDs and a random favourite, and guards combat and unowned actions", () => {
	const { client, api, flush } = setup(1);
	client.load(vi.fn());
	flush();
	client.summon("Pet-1");
	client.summon("species-39");
	client.summonFavourite();
	client.toggleFavourite("Pet-1");
	expect(api.SummonPetByGUID).toHaveBeenCalledExactlyOnceWith("Pet-1");
	expect(api.SummonRandomPet).toHaveBeenCalledExactlyOnceWith(true);
	expect(api.SetFavorite).toHaveBeenCalledExactlyOnceWith("Pet-1", 0);
	vi.stubGlobal("InCombatLockdown", () => true);
	client.summon("Pet-1");
	client.summonFavourite();
	expect(api.SummonPetByGUID).toHaveBeenCalledOnce();
	expect(api.SummonRandomPet).toHaveBeenCalledOnce();
});
