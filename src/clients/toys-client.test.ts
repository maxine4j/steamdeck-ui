import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { type Toy, ToysClient } from "./toys-client";

afterEach(() => vi.unstubAllGlobals());

it("restores the default visible catalogue during login warming after a filtered saved session", () => {
	const { client, pending, cache } = setup(1);
	cache.create<Toy>("toys.items").put("1", {
		id: 1,
		name: "Saved",
		icon: 101,
		collected: true,
		favourite: false,
		displayed: false,
	});
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const done = vi.fn();
	client.load(done);
	expect(done.mock.lastCall?.at(0).map((row: Toy) => row.id)).toEqual([1]);
});

it("searches the native toy journal instead of reusing a persisted unfiltered snapshot", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, api, pending } = setup(3, true);
	client.load(vi.fn());
	while (pending.length) pending.shift()?.();
	api.SetFilterString = vi.fn();
	api.GetNumFilteredToys = () => 1;
	api.GetToyFromIndex = () => 3;
	client.search("Toy 3");
	const done = vi.fn();
	client.load(done);
	while (pending.length) pending.shift()?.();
	expect(api.SetFilterString).toHaveBeenLastCalledWith("Toy 3");
	expect(done.mock.lastCall?.at(1)).toBe(true);
	expect(
		done.mock.lastCall?.at(0).map((toy: { id: number }) => toy.id),
	).toEqual([3]);
	client.refreshEntry(1);
	const updated = vi.fn();
	client.load(updated);
	while (pending.length) pending.shift()?.();
	expect(
		updated.mock.lastCall?.at(0).map((toy: { id: number }) => toy.id),
	).toEqual([3]);
	client.stop();
	const reopened = vi.fn();
	client.load(reopened);
	expect(
		reopened.mock.lastCall?.at(0).map((toy: { id: number }) => toy.id),
	).toEqual([3]);
});

it("exposes toy collection, usable-only and valid sources without redundant expansion filters", () => {
	const { client, api } = setup();
	const filters = Object.assign(api, {
		GetCollectedShown: () => true,
		GetUncollectedShown: () => false,
		GetUnusableShown: () => true,
		SetCollectedShown: vi.fn(),
		SetUncollectedShown: vi.fn(),
		SetUnusableShown: vi.fn(),
		IsSourceTypeFilterChecked: () => true,
		SetSourceTypeFilter: vi.fn(),
		IsExpansionTypeFilterChecked: () => true,
		SetExpansionTypeFilter: vi.fn(),
	});
	vi.stubGlobal("_G", {
		BATTLE_PET_SOURCE_1: "Drop",
		EXPANSION_NAME0: "Classic",
	});
	vi.stubGlobal("C_PetJournal", { GetNumPetSources: () => 2 });
	vi.stubGlobal("GetNumExpansions", () => 1);
	vi.stubGlobal("C_ToyBoxInfo", {
		SetDefaultFilters: vi.fn(),
		IsToySourceValid: (index: number) => index === 1,
	});
	expect(client.getFilters()).toEqual([
		{ id: "collected", label: "Collected", checked: true },
		{ id: "uncollected", label: "Not collected", checked: false },
		{ id: "usable", label: "Usable only", checked: false },
		{ id: "source:1", label: "Source: Drop", checked: true },
	]);
	client.toggleFilter("usable");
	client.toggleFilter("source:1");
	client.toggleFilter("expansion:1");
	client.toggleFilter("source:99");
	expect(filters.SetUnusableShown).toHaveBeenCalledWith(false);
	expect(filters.SetSourceTypeFilter).toHaveBeenCalledExactlyOnceWith(1, false);
	expect(filters.SetExpansionTypeFilter).not.toHaveBeenCalled();
});

it("updates a warm toy view from background events and serves the same latest data on reopening", () => {
	const { client, api, pending } = setup(1);
	client.load(vi.fn());
	while (pending.length) pending.shift()?.();
	api.GetToyInfo = (id) => [id, "Updated", 123, false];
	const opened = vi.fn();
	client.load(opened);
	expect(opened.mock.lastCall?.at(0).at(0).name).toBe("Toy 1");
	client.refreshEntry();
	while (pending.length) pending.shift()?.();
	expect(opened.mock.lastCall?.at(0).at(0).name).toBe("Updated");
	const reopened = vi.fn();
	client.load(reopened);
	expect(reopened.mock.lastCall?.at(0)).toEqual(opened.mock.lastCall?.at(0));
});

it("does not rescan persisted toys when reopening an unchanged journal", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, api, pending } = setup(45, true);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const info = vi.spyOn(api, "GetToyInfo");
	const done = vi.fn();
	client.load(done);
	while (pending.length) pending.shift()?.();
	client.load(done);
	while (pending.length) pending.shift()?.();
	expect(done).toHaveBeenCalledTimes(2);
	expect(info).not.toHaveBeenCalled();
});

it("publishes every usable page before a cold scan finishes", () => {
	const { client, pending, cache } = setup(65);
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done.mock.lastCall?.at(1)).toBe(false);
	expect(cache.create("toys.items").values()).toHaveLength(20);
	while (pending.length) pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(65);
	expect(done.mock.lastCall?.at(1)).toBe(true);
});

it("prefetches the full journal despite a saved native search and filters", () => {
	const { client, api, pending } = setup(25);
	let search = "old search";
	let filtered = true;
	api.GetNumFilteredToys = () => (search || filtered ? 4 : 25);
	api.SetFilterString = vi.fn((text: string) => {
		search = text;
		client.refreshEntry();
	});
	const reset = vi.fn(() => {
		filtered = false;
		client.refreshEntry();
	});
	vi.stubGlobal("C_ToyBoxInfo", {
		SetDefaultFilters: reset,
	});
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(25);
	expect(reset).toHaveBeenCalledOnce();
	expect(api.SetFilterString).toHaveBeenCalledExactlyOnceWith("");
});

it("keeps every toy when startup prefetch runs before toy names are cached", () => {
	const { client, api, pending } = setup(25);
	api.GetToyInfo = (id) =>
		id <= 4
			? [id, `Toy ${id}`, 100 + id, true]
			: [id, undefined, 100 + id, false];
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(25);
	expect(done.mock.lastCall?.at(0).at(4)).toMatchObject({
		id: 5,
		name: "Toy 5",
		icon: 105,
	});
});

it("prefetches in twenty-entry batches and reuses the snapshot on opening", () => {
	const { client, api, pending } = setup(45);
	const info = vi.spyOn(api, "GetToyInfo");
	client.prefetch();
	expect(info).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(20);
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(40);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(1)).toBe(true);
	client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(45);
	expect(done).toHaveBeenCalledTimes(5);
});

it("passes item cooldown values through without arithmetic", () => {
	const { client } = setup();
	vi.stubGlobal("C_Container", {
		GetItemCooldown: vi.fn(() => [10, 60, true]),
	});
	expect(client.getCooldown(42)).toEqual({ start: 10, duration: 60 });
	expect(C_Container.GetItemCooldown).toHaveBeenCalledExactlyOnceWith(42);
});

function setup(count = 2, persistent = false) {
	if (!persistent) vi.stubGlobal("SteamDeckUIConfig", {});
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
		SetFilterString: (_text: string) => {},
		GetNumFilteredToys: () => count,
		GetToyFromIndex: (index: number) => index,
		GetToyInfo: (id: number) => [id, `Toy ${id}`, 100 + id, id === 1],
		GetIsFavorite: () => true,
		SetIsFavorite: vi.fn(),
		IsToyUsable: () => true,
	};
	vi.stubGlobal("C_ToyBox", api);
	vi.stubGlobal("C_ToyBoxInfo", { SetDefaultFilters: vi.fn() });
	vi.stubGlobal("PlayerHasToy", (id: number) => id !== 2);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("C_Item", {
		GetItemInfo: (id: number) => [
			`Toy ${id}`,
			`item:${id}`,
			1,
			0,
			0,
			"",
			"",
			1,
			"",
			100,
			0,
			0,
			0,
			0,
			10,
		],
		RequestLoadItemDataByID: vi.fn(),
	});
	const cache = new CollectionCache(scheduler, () => "player");
	return {
		cache,
		scheduler,
		api,
		pending,
		client: new ToysClient(scheduler, cache),
	};
}

it("opens saved toys synchronously without scanning and remains subscribed to item updates", () => {
	const { client, cache, api, pending } = setup();
	const toy = {
		id: 1,
		name: "Cached",
		icon: 101,
		collected: false,
		favourite: false,
	};
	cache.create<Toy>("toys.items").put("1", toy);
	const info = vi.spyOn(api, "GetToyInfo");
	const done = vi.fn();
	client.load(done);
	expect(done.mock.lastCall?.at(0)).toEqual([toy]);
	expect(pending).toHaveLength(0);
	client.refreshEntry(1);
	while (pending.length) pending.shift()?.();
	expect(info).toHaveBeenCalledExactlyOnceWith(1);
	expect(done.mock.lastCall?.at(0).at(0).collected).toBe(true);
});

it("warms saved toys at login, persists and publishes each bounded page, and continues while closed", () => {
	const { client, cache, pending, api } = setup(45);
	cache.create("toys.items").put("1", {
		id: 1,
		name: "Saved",
		icon: 101,
		collected: false,
		favourite: false,
	});
	const done = vi.fn();
	const detach = client.load(done);
	const info = vi.spyOn(api, "GetToyInfo");
	client.prefetch();
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(20);
	expect(cache.create("toys.items").values()).toHaveLength(20);
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	detach();
	const calls = done.mock.calls.length;
	while (pending.length) pending.shift()?.();
	expect(cache.create("toys.items").values()).toHaveLength(45);
	expect(done).toHaveBeenCalledTimes(calls);
	expect(
		SteamDeckUIConfig?.collectionCache?.namespaces["toys.snapshot"],
	).toBeUndefined();
	const reopened = vi.fn();
	client.load(reopened);
	expect(reopened.mock.lastCall?.at(0)).toHaveLength(45);
	expect(pending).toHaveLength(0);
});

it("filters a warm toy cache without scanning details or discarding hidden entries", () => {
	const { client, api, cache, pending } = setup(3);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const info = vi.spyOn(api, "GetToyInfo");
	api.GetNumFilteredToys = () => 1;
	api.GetToyFromIndex = () => 2;
	const done = vi.fn();
	client.load(done);
	client.search("Toy 2");
	while (pending.length) pending.shift()?.();
	expect(done.mock.lastCall?.at(0).map((row: Toy) => row.id)).toEqual([2]);
	expect(info).not.toHaveBeenCalled();
	expect(cache.create("toys.items").values()).toHaveLength(3);
	client.refreshEntry();
	while (pending.length) pending.shift()?.();
	expect(info.mock.calls.map((args) => args.at(0)).sort()).toEqual([1, 2, 3]);
});

it("does not interpret native query-change events as server collection changes", () => {
	const { client, api, pending } = setup(2);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const info = vi.spyOn(api, "GetToyInfo");
	api.SetFilterString = () => client.refreshEntry();
	client.search("toy");
	while (pending.length) pending.shift()?.();
	expect(info).not.toHaveBeenCalled();
});

it("serves saved toys immediately and refreshes an event's item without enumerating the journal", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const first = setup(45, true);
	first.client.prefetch();
	while (first.pending.length) first.pending.shift()?.();
	first.client.stop();
	const next = setup(45, true);
	const count = vi.spyOn(next.api, "GetNumFilteredToys");
	const info = vi.spyOn(next.api, "GetToyInfo");
	const done = vi.fn();
	next.client.refreshEntry(1);
	next.client.load(done);
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(info).not.toHaveBeenCalled();
	while (next.pending.length) next.pending.shift()?.();
	expect(count).not.toHaveBeenCalled();
	expect(info).toHaveBeenCalledExactlyOnceWith(1);
});

it("refreshes toys from context-free events without relying on expiry", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, api, pending } = setup(45, true);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const info = vi.spyOn(api, "GetToyInfo");
	client.refreshEntry();
	while (pending.length) pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(45);
});

it("retains newly discovered toys when another event arrives during a refresh", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, pending } = setup(45, true);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	client.refreshEntry(46);
	pending.shift()?.();
	client.refreshEntry(47);
	while (pending.length) pending.shift()?.();
	const done = vi.fn();
	client.load(done);
	expect(
		done.mock.lastCall?.at(0)?.map((toy: { id: number }) => toy.id),
	).toContain(46);
	expect(
		done.mock.lastCall?.at(0)?.map((toy: { id: number }) => toy.id),
	).toContain(47);
	client.stop();
});

it("retains saved metadata while Blizzard item data is temporarily unavailable", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, api, pending } = setup(2, true);
	api.GetToyInfo = (id) => [id, "Named toy", 101, true];
	client.prefetch();
	while (pending.length) pending.shift()?.();
	api.GetToyInfo = (id) => [id, undefined, 101, true];
	vi.stubGlobal("C_Item", {
		GetItemInfo: () => [],
		RequestLoadItemDataByID: vi.fn(),
	});
	client.refreshEntry(1);
	while (pending.length) pending.shift()?.();
	const done = vi.fn();
	client.load(done);
	expect(done.mock.lastCall?.at(0)?.at(0)).toMatchObject({
		name: "Named toy",
		expansionId: 10,
	});
	client.stop();
});

it("converts journal entries and item expansion metadata without using native frames", () => {
	const { client, pending } = setup();
	const done = vi.fn();
	client.load(done);
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toMatchObject([
		{
			id: 1,
			name: "Toy 1",
			icon: 101,
			favourite: true,
			collected: true,
			expansionId: 10,
		},
		{
			id: 2,
			name: "Toy 2",
			icon: 102,
			favourite: false,
			collected: false,
			expansionId: 10,
		},
	]);
});

it("finishes bounded enumeration after closing and reuses the cache on reopening", () => {
	const { client, api, pending } = setup(45);
	const info = vi.spyOn(api, "GetToyInfo");
	const done = vi.fn();
	const cancel = client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(20);
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	expect(pending).toHaveLength(1);
	cancel();
	const calls = done.mock.calls.length;
	while (pending.length) pending.shift()?.();
	expect(done).toHaveBeenCalledTimes(calls);
	expect(info).toHaveBeenCalledTimes(45);
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(info).toHaveBeenCalledTimes(45);
});

it("reports scanned entries against the total each frame, including skipped entries", () => {
	const { client, api, pending } = setup(45);
	api.GetToyFromIndex = (index) => (index === 1 ? 0 : index);
	const progress = vi.fn();
	const done = vi.fn();
	client.load(done, progress);
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(20, 45);
	expect(done.mock.lastCall?.at(0)).toHaveLength(19);
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(40, 45);
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(45, 45);
	expect(done.mock.lastCall?.at(0)).toHaveLength(44);
});

it("reports an empty collection and stops reporting after cancellation", () => {
	const { client, pending } = setup(0);
	const progress = vi.fn();
	const done = vi.fn();
	const detach = client.load(done, progress);
	pending.shift()?.();
	expect(progress).toHaveBeenCalledExactlyOnceWith(0, 0);
	expect(done).toHaveBeenCalledExactlyOnceWith([], true);
	detach();
	const cancel = client.load(done, progress);
	cancel();
	pending.shift()?.();
	expect(progress).toHaveBeenCalledTimes(1);
	expect(done).toHaveBeenCalledTimes(1);
});

it("detaching one observer does not remove another observer's shared progress callback", () => {
	const { client, pending } = setup(45);
	const progress = vi.fn();
	client.load(vi.fn(), progress);
	client.load(vi.fn(), progress)();
	pending.shift()?.();
	expect(progress).toHaveBeenCalledExactlyOnceWith(20, 45);
});

it("queues native searches until every initial journal entry is cached", () => {
	const { client, api, pending, cache } = setup(45);
	let search = "";
	api.SetFilterString = vi.fn((text) => {
		search = text;
	});
	api.GetNumFilteredToys = () => (search ? 1 : 45);
	client.prefetch();
	pending.shift()?.();
	api.SetFilterString.mockClear();
	client.search("toy");
	expect(api.SetFilterString).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(cache.create("toys.items").values()).toHaveLength(45);
	expect(api.SetFilterString).toHaveBeenCalledExactlyOnceWith("toy");
});

it("keeps pending filter toggles coherent while the initial journal scan is running", () => {
	const { client, api, pending } = setup(45);
	Object.assign(api, {
		GetCollectedShown: () => true,
		GetUncollectedShown: () => true,
		GetUnusableShown: () => true,
		SetCollectedShown: vi.fn(),
	});
	vi.stubGlobal("_G", {});
	vi.stubGlobal("C_PetJournal", { GetNumPetSources: () => 0 });
	client.prefetch();
	client.toggleFilter("collected");
	expect(client.getFilters().at(0)?.checked).toBe(false);
	client.toggleFilter("collected");
	expect(client.getFilters().at(0)?.checked).toBe(true);
	while (pending.length) pending.shift()?.();
	expect(api.SetCollectedShown.mock.calls.map((args) => args.at(0))).toEqual([
		false,
		true,
	]);
});

it("retains every initial toy ID when a favourite action would reorder the native journal", () => {
	const { client, api, pending, cache } = setup(45);
	const ids = Array.from({ length: 45 }, (_, index) => index + 1);
	api.GetToyFromIndex = (index) => ids.at(index - 1) ?? 0;
	api.SetIsFavorite = vi.fn(() => {
		const first = ids.shift();
		if (first !== undefined) ids.push(first);
	});
	client.prefetch();
	pending.shift()?.();
	client.toggleFavourite(1);
	expect(api.SetIsFavorite).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(cache.create("toys.items").values()).toHaveLength(45);
	expect(api.SetIsFavorite).toHaveBeenCalledExactlyOnceWith(1, false);
});

it("requests missing metadata once and re-reads loaded expansion data", () => {
	const { client, pending } = setup(1);
	const request = vi.fn();
	const info = vi.fn(() => [] as unknown[]);
	vi.stubGlobal("C_Item", {
		GetItemInfo: info,
		RequestLoadItemDataByID: request,
	});
	const done = vi.fn();
	for (let i = 0; i < 2; i++) {
		client.load(done);
		pending.shift()?.();
	}
	expect(request).toHaveBeenCalledExactlyOnceWith(1);
	expect(done.mock.calls.at(-1)?.at(0).at(0).expansionId).toBeUndefined();
	info.mockReturnValue([
		"Loaded",
		"",
		0,
		0,
		0,
		"",
		"",
		0,
		"",
		0,
		0,
		0,
		0,
		0,
		11,
	]);
	client.refreshEntry();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.calls.at(-1)?.at(0).at(0).expansionId).toBe(11);
});

it("updates the cached favourite after an action without another detail scan", () => {
	const { client, api, pending, cache } = setup(2);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const info = vi.spyOn(api, "GetToyInfo");
	api.SetIsFavorite = vi.fn(() => {
		info.mockImplementation((id) => [id, `Toy ${id}`, 100 + id, false]);
		client.refreshEntry();
	});
	client.toggleFavourite(1);
	while (pending.length) pending.shift()?.();
	expect(cache.create("toys.items").peek("1")).toMatchObject({
		favourite: false,
	});
	expect(info).toHaveBeenCalledExactlyOnceWith(1);
});

it("toggles live favourite state only for collected toys and guards use eligibility", () => {
	const { client, api } = setup();
	client.toggleFavourite(1);
	expect(api.SetIsFavorite).toHaveBeenCalledExactlyOnceWith(1, false);
	client.toggleFavourite(2);
	expect(api.SetIsFavorite).toHaveBeenCalledTimes(1);
	expect(client.canUse(1)).toBe(true);
	expect(client.canUse(2)).toBe(false);
	api.IsToyUsable = () => false;
	expect(client.canUse(1)).toBe(false);
	api.IsToyUsable = () => true;
	vi.stubGlobal("InCombatLockdown", () => true);
	expect(client.canUse(1)).toBe(false);
	expect(client.isInCombat()).toBe(true);
});
