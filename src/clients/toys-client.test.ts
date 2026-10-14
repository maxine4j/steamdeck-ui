import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { ToysClient } from "./toys-client";

afterEach(() => vi.unstubAllGlobals());

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
	expect(done).toHaveBeenCalledOnce();
	expect(
		done.mock.lastCall?.at(0).map((toy: { id: number }) => toy.id),
	).toEqual([3]);
	client.invalidate(1);
	const updated = vi.fn();
	client.load(updated);
	while (pending.length) pending.shift()?.();
	expect(
		updated.mock.lastCall?.at(0).map((toy: { id: number }) => toy.id),
	).toEqual([3]);
	client.stop();
	const reopened = vi.fn();
	client.load(reopened, undefined, undefined, true);
	expect(
		reopened.mock.lastCall?.at(0).map((toy: { id: number }) => toy.id),
	).toEqual([1, 2, 3]);
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

it("keeps a warm toy snapshot fixed while refreshing cached metadata for reopening", () => {
	const { client, api, pending } = setup(1);
	client.load(vi.fn());
	while (pending.length) pending.shift()?.();
	api.GetToyInfo = (id) => [id, "Updated", 123, false];
	client.invalidate();
	const opened = vi.fn();
	client.load(opened, undefined, undefined, true);
	while (pending.length) pending.shift()?.();
	expect(opened).toHaveBeenCalledOnce();
	expect(opened.mock.lastCall?.at(0).at(0).name).toBe("Toy 1");
	const reopened = vi.fn();
	client.load(reopened, undefined, undefined, true);
	expect(reopened.mock.lastCall?.at(0).at(0).name).toBe("Updated");
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

it("publishes an early usable page before a cold scan finishes", () => {
	const { client, pending } = setup(65);
	const done = vi.fn();
	const preview = vi.fn();
	client.load(done, undefined, preview);
	pending.shift()?.();
	expect(preview.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(preview).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(0)).toHaveLength(65);
});

it("prefetches the full journal despite a saved native search and filters", () => {
	const { client, api, pending } = setup(25);
	let search = "old search";
	let filtered = true;
	api.GetNumFilteredToys = () => (search || filtered ? 4 : 25);
	api.SetFilterString = vi.fn((text: string) => {
		search = text;
		client.invalidate();
	});
	const reset = vi.fn(() => {
		filtered = false;
		client.invalidate();
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
	expect(done).toHaveBeenCalledOnce();
	client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(45);
	expect(done).toHaveBeenCalledTimes(2);
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
	return {
		api,
		pending,
		client: new ToysClient(
			scheduler,
			persistent
				? new CollectionCache(
						scheduler,
						() => 100,
						() => "player",
					)
				: undefined,
		),
	};
}

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
	next.client.invalidate(1);
	next.client.load(done);
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(info).not.toHaveBeenCalled();
	while (next.pending.length) next.pending.shift()?.();
	expect(count).not.toHaveBeenCalled();
	expect(info).toHaveBeenCalledExactlyOnceWith(1);
});

it("uses item TTLs to avoid rereading fresh toys for events without an item ID", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, api, pending } = setup(45, true);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const info = vi.spyOn(api, "GetToyInfo");
	client.invalidate();
	while (pending.length) pending.shift()?.();
	expect(info).not.toHaveBeenCalled();
});

it("retains newly discovered toys when another event arrives during a refresh", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const { client, pending } = setup(45, true);
	client.prefetch();
	while (pending.length) pending.shift()?.();
	client.invalidate(46);
	pending.shift()?.();
	client.invalidate(47);
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
	client.invalidate(1);
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
	expect(done).toHaveBeenCalledExactlyOnceWith([
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
	expect(done).not.toHaveBeenCalled();
	expect(pending).toHaveLength(1);
	cancel();
	while (pending.length) pending.shift()?.();
	expect(done).not.toHaveBeenCalled();
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
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(40, 45);
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(45, 45);
	expect(done.mock.calls.at(0)?.at(0)).toHaveLength(44);
});

it("reports an empty collection and stops reporting after cancellation", () => {
	const { client, pending } = setup(0);
	const progress = vi.fn();
	const done = vi.fn();
	client.load(done, progress);
	pending.shift()?.();
	expect(progress).toHaveBeenCalledExactlyOnceWith(0, 0);
	expect(done).toHaveBeenCalledExactlyOnceWith([]);
	const cancel = client.load(done, progress);
	cancel();
	pending.shift()?.();
	expect(progress).toHaveBeenCalledTimes(1);
	expect(done).toHaveBeenCalledTimes(1);
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
	client.invalidate();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.calls.at(-1)?.at(0).at(0).expansionId).toBe(11);
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
