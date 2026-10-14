import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { type Pet, PetsClient } from "./pets-client";

afterEach(() => vi.unstubAllGlobals());

it("restores the default visible catalogue during login warming after a filtered saved session", () => {
	const { client, flush, cache } = setup(1);
	cache.create<Pet>("pets.items").put("Pet-1", {
		id: "Pet-1",
		speciesId: 39,
		name: "Saved",
		icon: 123,
		collected: true,
		favourite: false,
		displayed: false,
	});
	client.prefetch();
	flush();
	const done = vi.fn();
	client.load(done);
	expect(done.mock.lastCall?.at(0).map((row: Pet) => row.id)).toEqual([
		"Pet-1",
	]);
});

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
		"Pet-3",
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
	expect(done.mock.lastCall?.at(1)).toBe(true);
	expect(
		done.mock.lastCall?.at(0).map((pet: { id: string }) => pet.id),
	).toEqual(["Pet-3"]);
	client.stop();
	const reopened = vi.fn();
	client.load(reopened);
	expect(
		reopened.mock.lastCall?.at(0).map((pet: { id: string }) => pet.id),
	).toEqual(["Pet-3"]);
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
		GetOwnedPetIDs: vi.fn(() =>
			Array.from({ length: count }, (_, index) => `Pet-${index + 1}`),
		),
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
	const cache = new CollectionCache(scheduler);
	const client = new PetsClient(scheduler, cache);
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	return {
		client,
		cache,
		scheduler,
		api,
		pending,
		flush,
	};
}

it("opens saved pets synchronously without scanning and keeps an observer for targeted events", () => {
	const { client, cache, api, flush } = setup(2);
	const pet = {
		id: "Pet-1",
		speciesId: 39,
		name: "Saved",
		icon: 123,
		collected: true,
		favourite: false,
	};
	cache.create("pets.items").put(pet.id, pet);
	const done = vi.fn();
	client.load(done);
	expect(done.mock.lastCall?.at(0)).toEqual([pet]);
	expect(api.GetPetInfoByIndex).not.toHaveBeenCalled();
	client.refreshEntry(pet.id);
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-1");
	expect(done.mock.lastCall?.at(0).at(0).name).toBe("Renamed");
});

it("warms saved pets at login and publishes persisted pages while keeping hidden scans alive", () => {
	const { client, cache, pending, flush, api } = setup();
	cache.create("pets.items").put("Pet-1", {
		id: "Pet-1",
		speciesId: 39,
		name: "Saved",
		icon: 123,
		collected: true,
		favourite: false,
	});
	const done = vi.fn();
	const detach = client.load(done);
	client.prefetch();
	pending.shift()?.();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(20);
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	detach();
	const calls = done.mock.calls.length;
	flush();
	expect(done).toHaveBeenCalledTimes(calls);
	const next = new PetsClient({}, cache);
	const reopened = vi.fn();
	next.load(reopened);
	expect(reopened.mock.lastCall?.at(0)).toHaveLength(45);
	expect(
		SteamDeckUIConfig?.collectionCache?.namespaces["pets.snapshot"],
	).toBeUndefined();
});

it("refreshes a newly collected GUID outside a native filter without scanning the journal", () => {
	const { client, api, cache, flush } = setup(1);
	client.prefetch();
	flush();
	api.GetNumPets.mockReturnValue([0, 0]);
	api.GetPetInfoByPetID.mockClear();
	api.GetPetInfoByIndex.mockClear();
	const done = vi.fn();
	client.load(done);
	client.refreshEntry("Pet-new");
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-new");
	expect(api.GetPetInfoByIndex).not.toHaveBeenCalled();
	expect(cache.create("pets.items").peek("Pet-new")).toMatchObject({
		collected: true,
		name: "Renamed",
	});
});

it("does not interpret synchronous native search events as server collection changes", () => {
	const { client, api, flush } = setup(2);
	client.prefetch();
	flush();
	Object.assign(api, { SetSearchFilter: () => client.refreshEntry() });
	api.GetPetInfoByPetID.mockClear();
	client.search("cat");
	flush();
	expect(api.GetPetInfoByPetID).not.toHaveBeenCalled();
});

it("preserves both targeted GUID updates when they share a species and one page", () => {
	const { client, api, flush, cache } = setup(2);
	client.prefetch();
	flush();
	api.GetPetInfoByPetID.mockImplementation((id) => [
		39,
		`Updated ${id}`,
		1,
		0,
		0,
		0,
		true,
		"Cat",
		123,
	]);
	client.refreshEntry("Pet-1");
	client.refreshEntry("Pet-2");
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		name: "Updated Pet-1",
	});
	expect(cache.create("pets.items").peek("Pet-2")).toMatchObject({
		name: "Updated Pet-2",
	});
});

it("handles deletion and restoration by GUID while preserving the unowned species and saved entries", () => {
	const { client, cache, api, flush } = setup(1);
	client.prefetch();
	flush();
	api.GetNumCollectedInfo.mockReturnValue([0, 3]);
	const done = vi.fn();
	client.load(done);
	client.refreshEntry("Pet-1", true);
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		present: false,
		collected: false,
	});
	expect(done.mock.lastCall?.at(0)).toMatchObject([
		{ id: "species-39", collected: false, ownedCount: 0 },
	]);
	api.GetNumCollectedInfo.mockReturnValue([1, 3]);
	client.refreshEntry("Pet-1");
	flush();
	expect(done.mock.lastCall?.at(0)).toMatchObject([
		{ id: "Pet-1", collected: true, ownedCount: 1 },
	]);
	expect(cache.create("pets.items").peek("species-39")).toBeDefined();
});

it("queues native searches until the initial unfiltered catalogue is fully cached", () => {
	const { client, api, pending, cache, flush } = setup();
	let search = "";
	Object.assign(api, {
		SetSearchFilter: vi.fn((text) => {
			search = text;
		}),
	});
	api.GetNumPets.mockImplementation(() => [search ? 1 : 45, 45]);
	client.prefetch();
	pending.shift()?.();
	client.search("cat");
	expect(api.SetSearchFilter).not.toHaveBeenCalled();
	flush();
	expect(cache.create("pets.items").values()).toHaveLength(45);
	expect(api.GetPetInfoByPetID).not.toHaveBeenCalled();
	expect(api.SetSearchFilter).toHaveBeenCalledExactlyOnceWith("cat");
});

it("keeps pending pet filter toggles coherent during initial warming", () => {
	const { client, api, flush } = setup();
	Object.assign(api, {
		IsFilterChecked: () => true,
		SetFilterChecked: vi.fn(),
		GetNumPetTypes: () => 0,
		GetNumPetSources: () => 0,
	});
	vi.stubGlobal("_G", { LE_PET_JOURNAL_FILTER_COLLECTED: 1 });
	client.prefetch();
	client.toggleFilter("collected");
	expect(client.getFilters().at(0)?.checked).toBe(false);
	client.toggleFilter("collected");
	expect(client.getFilters().at(0)?.checked).toBe(true);
	flush();
	expect(api.SetFilterChecked.mock.calls.map((args) => args.at(1))).toEqual([
		false,
		true,
	]);
});

it("keeps revoked GUIDs hidden across a broad update until the server restores them", () => {
	const { client, cache, flush } = setup(1);
	client.prefetch();
	flush();
	client.refreshEntry("Pet-1", true);
	flush();
	client.refreshEntry();
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		present: false,
	});
	client.refreshEntry("Pet-1");
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		present: true,
	});
});

it("keeps a revoked pet hidden when the broad scan runs before its targeted update", () => {
	const { client, cache, flush } = setup(1);
	client.prefetch();
	flush();
	client.refreshEntry();
	client.refreshEntry("Pet-1", true);
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		present: false,
	});
});

it("uses the latest server ownership event when revoke and restore arrive in one frame", () => {
	const { client, cache, flush } = setup(1);
	client.prefetch();
	flush();
	client.refreshEntry("Pet-1", true);
	client.refreshEntry("Pet-1");
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		present: true,
	});
});

it("queues favourite actions that would reorder the initial pet journal scan", () => {
	const { client, api, pending, cache, flush } = setup();
	const ids = Array.from({ length: 45 }, (_, index) => `Pet-${index + 1}`);
	api.GetPetInfoByIndex.mockImplementation((index) => [
		ids.at(index - 1),
		39,
		true,
		undefined,
		1,
		false,
		false,
		"Cat",
		123,
	]);
	api.SetFavorite.mockImplementation(() => {
		const first = ids.shift();
		if (first !== undefined) ids.push(first);
	});
	client.prefetch();
	pending.shift()?.();
	client.toggleFavourite("Pet-1");
	expect(api.SetFavorite).not.toHaveBeenCalled();
	flush();
	expect(cache.create("pets.items").values()).toHaveLength(45);
	expect(api.SetFavorite).toHaveBeenCalledExactlyOnceWith("Pet-1", 0);
});

it("only rereads the event's pet during repeated targeted refreshes", () => {
	const { client, api, flush } = setup(2);
	client.load(vi.fn());
	flush();
	client.refreshEntry("Pet-2");
	client.load(vi.fn());
	flush();
	api.GetPetInfoByPetID.mockClear();
	client.refreshEntry("Pet-2");
	client.load(vi.fn());
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
});

it("updates the cached favourite after an action without another detail scan", () => {
	const { client, api, cache, flush } = setup(2);
	api.GetPetInfoByIndex.mockImplementation((index) => [
		`Pet-${index}`,
		39,
		true,
		undefined,
		1,
		true,
		false,
		"Cat",
		123,
	]);
	client.prefetch();
	flush();
	api.SetFavorite.mockImplementation(() => {
		api.GetPetInfoByPetID.mockReturnValue([
			39,
			"Cat",
			1,
			0,
			0,
			0,
			false,
			"Cat",
			123,
		]);
		client.refreshEntry();
	});
	api.GetPetInfoByIndex.mockClear();
	client.toggleFavourite("Pet-1");
	flush();
	expect(cache.create("pets.items").peek("Pet-1")).toMatchObject({
		favourite: false,
	});
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(2);
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
	client.refreshEntry("Pet-2");
	client.load(vi.fn());
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
});
it("prefetches twenty pets per frame, previews early and reuses unchanged snapshots", () => {
	const { client, api, pending, flush } = setup();
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(20);
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done.mock.lastCall?.at(1)).toBe(false);
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
	client.refreshEntry("Pet-2");
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
	api.GetOwnedPetIDs.mockReturnValue(["Pet-1"]);
	client.refreshEntry();
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
