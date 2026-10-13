import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { MountsClient } from "./mounts-client";

it("shows saved mounts instantly and refreshes only the changed mount without recounting the collection", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return () => {};
		},
	};
	const cache = new CollectionCache(
		scheduler,
		() => 100,
		() => "player",
	);
	const mount = {
		id: 42,
		index: 1,
		name: "Old",
		spell: 1,
		icon: 2,
		collected: false,
		usable: false,
		favourite: false,
	};
	cache
		.create("mounts.snapshot")
		.put("snapshot", { mounts: [mount], count: { collected: 0, total: 1 } });
	cache.create("mounts.items").put("42", mount);
	const info = vi.fn(() => [
		"New",
		1,
		2,
		false,
		true,
		0,
		false,
		false,
		0,
		false,
		true,
	]);
	const ids = vi.fn(() => [42]);
	vi.stubGlobal("C_MountJournal", {
		GetMountInfoByID: info,
		GetMountIDs: ids,
		GetNumDisplayedMounts: () => 1,
		GetDisplayedMountID: () => 42,
	});
	const client = new MountsClient(scheduler, cache);
	client.invalidate(42);
	const done = vi.fn();
	client.load(done);
	expect(done.mock.lastCall?.at(0)?.at(0)?.name).toBe("Old");
	expect(info).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(ids).not.toHaveBeenCalled();
	expect(info).toHaveBeenCalledExactlyOnceWith(42);
	expect(done.mock.lastCall?.at(0)?.at(0)?.name).toBe("New");
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 1, total: 1 });
});

it("refreshes a changed mount outside the current filter and updates the account count", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return () => {};
		},
	};
	const cache = new CollectionCache(
		scheduler,
		() => 100,
		() => "player",
	);
	cache
		.create("mounts.snapshot")
		.put("snapshot", { mounts: [], count: { collected: 0, total: 1 } });
	cache.create("mounts.items").put("42", {
		id: 42,
		index: 0,
		name: "Old",
		spell: 1,
		icon: 2,
		collected: false,
		usable: false,
		favourite: false,
	});
	const info = vi.fn(() => [
		"New",
		1,
		2,
		false,
		true,
		0,
		false,
		false,
		0,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetMountInfoByID: info,
		GetNumDisplayedMounts: () => 0,
	});
	const client = new MountsClient(scheduler, cache);
	client.invalidate(42);
	client.load(() => {});
	while (pending.length) pending.shift()?.();
	expect(info).toHaveBeenCalledExactlyOnceWith(42);
	expect(client.getCount()).toEqual({ collected: 1, total: 1 });
});

it("does not reread fresh mount details on an event without an ID", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return () => {};
		},
	};
	const cache = new CollectionCache(
		scheduler,
		() => 100,
		() => "player",
	);
	const mount = {
		id: 42,
		index: 1,
		name: "Saved",
		spell: 1,
		icon: 2,
		collected: false,
		usable: false,
		favourite: false,
	};
	cache
		.create("mounts.snapshot")
		.put("snapshot", { mounts: [mount], count: { collected: 0, total: 1 } });
	cache.create("mounts.items").put("42", mount);
	const info = vi.fn(() => [
		"Saved",
		1,
		2,
		false,
		true,
		0,
		false,
		false,
		0,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetMountInfoByID: info,
		GetNumDisplayedMounts: () => 1,
		GetDisplayedMountID: () => 42,
	});
	const client = new MountsClient(scheduler, cache);
	client.invalidate();
	client.load(() => {});
	while (pending.length) pending.shift()?.();
	expect(info).not.toHaveBeenCalled();
});

it("retains count changes when another mount event arrives during a refresh", () => {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return () => {};
		},
	};
	const cache = new CollectionCache(
		scheduler,
		() => 100,
		() => "player",
	);
	const mounts = [41, 42].map((id) => ({
		id,
		index: id - 40,
		name: "Saved",
		spell: 1,
		icon: 2,
		collected: false,
		usable: false,
		favourite: false,
	}));
	cache
		.create("mounts.snapshot")
		.put("snapshot", { mounts, count: { collected: 0, total: 2 } });
	for (const mount of mounts)
		cache.create("mounts.items").put(String(mount.id), mount);
	const client = new MountsClient(scheduler, cache);
	vi.stubGlobal("C_MountJournal", {
		GetMountInfoByID: (id: number) => {
			if (id === 41) client.invalidate(42);
			return ["Updated", 1, 2, false, true, 0, false, false, 0, false, true];
		},
		GetNumDisplayedMounts: () => 2,
		GetDisplayedMountID: (index: number) => index + 40,
	});
	client.invalidate(41);
	client.load(() => {});
	while (pending.length) pending.shift()?.();
	expect(client.getCount()).toEqual({ collected: 2, total: 2 });
});

const scheduler = { nextFrame: vi.fn(() => vi.fn()) };

afterEach(() => vi.unstubAllGlobals());
it("summons by journal ID and picks up the random favourite action", () => {
	const summon = vi.fn();
	const pickup = vi.fn();
	vi.stubGlobal("C_MountJournal", { SummonByID: summon, Pickup: pickup });
	const client = new MountsClient(scheduler);
	client.summon(42);
	client.summon(0);
	client.pickupRandom();
	expect(summon.mock.calls).toEqual([[42], [0]]);
	expect(pickup).toHaveBeenCalledExactlyOnceWith(0);
});
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
	const client = new MountsClient(scheduler);
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
	const displayedCount = vi.fn(() => 1);
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
		GetNumDisplayedMounts: displayedCount,
		GetDisplayedMountID: () => 20,
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
	const client = new MountsClient(scheduler);
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
			expansionId: 0,
		},
	]);
	const result = vi.fn();
	client.setFavourite(20, false, result);
	expect(favourite).toHaveBeenCalledWith(1, false);
	expect(result).toHaveBeenCalledExactlyOnceWith(true);
	client.setFavourite(999, true, result);
	expect(favourite).toHaveBeenCalledTimes(1);
	// Cached writes do not enumerate the journal; an unknown ID only queries size.
	expect(displayedCount).toHaveBeenCalledTimes(2);
});

it("updates a cached favourite without rescanning mount details or collection counts", () => {
	const details = vi.fn(() => [
		"Horse",
		123,
		1,
		false,
		true,
		1,
		false,
		false,
		null,
		false,
		true,
		6,
	]);
	const info = vi.fn(() => ["Horse", 123, 1, false, true, 1, true]);
	const set = vi.fn();
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 1,
		GetDisplayedMountInfo: details,
		GetDisplayedMountID: () => 6,
		GetIsFavorite: () => [false, true],
		SetIsFavorite: set,
		GetMountInfoByID: info,
	});
	const client = new MountsClient(scheduler);
	client.getMounts();
	details.mockClear();
	client.setFavourite(6, true, vi.fn());
	expect(set).toHaveBeenCalledExactlyOnceWith(1, true);
	expect(details).not.toHaveBeenCalled();
	expect(info).not.toHaveBeenCalled();
	expect(client.getFavourite(6)).toBe(true);
	expect(info).toHaveBeenCalledExactlyOnceWith(6);
});

it("checks current summon eligibility by ID without enumerating the journal", () => {
	const info = vi.fn(() => [
		"Horse",
		123,
		1,
		false,
		true,
		1,
		false,
		false,
		null,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", { GetMountInfoByID: info });
	const client = new MountsClient(scheduler);
	expect(client.canUse(6)).toBe(true);
	info.mockReturnValue([
		"Horse",
		123,
		1,
		false,
		false,
		1,
		false,
		false,
		null,
		false,
		true,
	]);
	expect(client.canUse(6)).toBe(false);
	expect(info.mock.calls).toEqual([[6], [6]]);
});

it("resolves reordered indices in bounded ID-only batches and never favourites the wrong mount", () => {
	const pending: (() => void)[] = [];
	const client = new MountsClient({
		nextFrame: (step) => {
			pending.push(step);
			return vi.fn();
		},
	});
	const displayedID = vi.fn((index: number) =>
		index === 45 ? 6 : index + 100,
	);
	const set = vi.fn();
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 45,
		GetDisplayedMountInfo: (index: number) => [
			"Horse",
			123,
			1,
			false,
			true,
			1,
			false,
			false,
			null,
			false,
			true,
			index === 1 ? 6 : index + 100,
		],
		GetDisplayedMountID: displayedID,
		GetIsFavorite: () => [false, true],
		SetIsFavorite: set,
	});
	client.getMounts();
	const done = vi.fn();
	client.setFavourite(6, true, done);
	expect(set).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(displayedID).toHaveBeenCalledTimes(21);
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(set).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(set).toHaveBeenCalledExactlyOnceWith(45, true);
	expect(done).toHaveBeenCalledExactlyOnceWith(true);
});

it("finishes the full scan without duplicate or skipped IDs when unfavouriting reorders the preview", () => {
	const pending: (() => void)[] = [];
	const client = new MountsClient({
		nextFrame: (step) => {
			pending.push(step);
			return vi.fn();
		},
	});
	const ids = Array.from({ length: 45 }, (_, i) => i + 1);
	const info = (id: number) => [
		`Mount ${id}`,
		id,
		1,
		false,
		true,
		1,
		id === 1,
		false,
		null,
		false,
		true,
		id,
	];
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => ids.length,
		GetDisplayedMountID: (index: number) => ids.at(index - 1),
		GetDisplayedMountInfo: (index: number) => info(ids.at(index - 1) ?? 0),
		GetMountIDs: () => Array.from({ length: 45 }, (_, i) => i + 1),
		GetMountInfoByID: info,
		GetIsFavorite: () => [true, true],
		SetIsFavorite: () => {
			const first = ids.shift();
			if (first !== undefined) ids.push(first);
		},
	});
	const done = vi.fn();
	let changed = false;
	client.load(done, () => {
		if (changed) return;
		changed = true;
		client.setFavourite(1, false, vi.fn());
	});
	while (pending.length) pending.shift()?.();
	const result = done.mock.calls.at(0)?.at(0) as { id: number }[];
	expect(result).toHaveLength(45);
	expect(new Set(result.map((mount) => mount.id)).size).toBe(45);
	expect(result.map((mount) => mount.id)).toContain(21);
});

it("prefetches bounded enumeration and counts, then serves cached mounts", () => {
	const pending: (() => void)[] = [];
	const displayed = vi.fn((id: number) => [
		`Mount ${id}`,
		id,
		id,
		false,
		true,
		1,
		false,
		false,
		undefined,
		false,
		true,
		id,
	]);
	const info = vi.fn(() => [
		"Mount",
		1,
		1,
		false,
		true,
		1,
		false,
		false,
		undefined,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 25,
		GetDisplayedMountInfo: displayed,
		GetMountIDs: () => Array.from({ length: 25 }, (_, i) => i + 1),
		GetMountInfoByID: info,
	});
	const client = new MountsClient({
		nextFrame: (callback) => {
			pending.push(callback);
			return () => {};
		},
	});
	client.prefetch();
	expect(displayed).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(20);
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(25);
	expect(info).toHaveBeenCalledTimes(15);
	pending.shift()?.();
	expect(done).toHaveBeenCalledWith(expect.any(Array), {
		collected: 25,
		total: 25,
	});
	client.load(done);
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(25);
	expect(info).toHaveBeenCalledTimes(25);
	expect(done).toHaveBeenCalledTimes(2);
});

it("loads the journal across frames and caches an obsolete load for reopening", () => {
	const pending: (() => void)[] = [];
	const nextFrame = (callback: () => void) => {
		let cancelled = false;
		pending.push(() => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	};
	const displayed = vi.fn((index: number) => [
		`Mount ${index}`,
		123,
		456,
		false,
		true,
		1,
		false,
		false,
		null,
		index === 2,
		true,
		index,
	]);
	const info = vi.fn(() => [
		"Mount",
		123,
		456,
		false,
		true,
		1,
		false,
		false,
		null,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 45,
		GetDisplayedMountInfo: displayed,
		GetMountIDs: () => [1, 2, 3],
		GetMountInfoByID: info,
	});
	const client = new MountsClient({ nextFrame });
	const done = vi.fn();
	const progress = vi.fn();
	client.load(done, undefined, progress);
	expect(displayed).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(20);
	expect(progress).toHaveBeenLastCalledWith(20, 48);
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(40);
	pending.shift()?.();
	expect(done).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(0)).toHaveLength(44);
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 3, total: 3 });
	expect(progress).toHaveBeenLastCalledWith(48, 48);
	client.invalidate();
	const obsolete = vi.fn();
	const cancel = client.load(obsolete);
	pending.shift()?.();
	cancel();
	while (pending.length) pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(90);
	expect(obsolete).not.toHaveBeenCalled();
	client.load(done);
	pending.shift()?.();
	expect(done).toHaveBeenCalledTimes(2);
	expect(displayed).toHaveBeenCalledTimes(90);
	expect(info).toHaveBeenCalledTimes(6);
});

it("publishes a first page before enumeration and counting finish, without hidden mounts", () => {
	const pending: (() => void)[] = [];
	const nextFrame = (callback: () => void) => {
		let cancelled = false;
		pending.push(() => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	};
	const info = vi.fn(() => [
		"Mount",
		1,
		2,
		false,
		true,
		1,
		false,
		false,
		null,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 65,
		GetDisplayedMountInfo: (index: number) => [
			`Mount ${index}`,
			1,
			2,
			false,
			true,
			1,
			false,
			false,
			null,
			index <= 20,
			true,
			index,
		],
		GetMountIDs: () => Array.from({ length: 100 }, (_, index) => index + 1),
		GetMountInfoByID: info,
	});
	const client = new MountsClient({ nextFrame });
	const done = vi.fn();
	const preview = vi.fn();
	client.load(done, preview);
	pending.shift()?.();
	expect(preview).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(preview).toHaveBeenCalledOnce();
	const firstPage = preview.mock.lastCall?.at(0);
	expect(firstPage).toHaveLength(20);
	expect(firstPage.at(0)?.id).toBe(21);
	expect(info).not.toHaveBeenCalled();
	expect(done).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(firstPage).toHaveLength(20);
	expect(preview).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 100, total: 100 });
	// Closing from the preview detaches callbacks while the cache fills.
	client.invalidate();
	let cancel = () => {};
	const obsolete = vi.fn();
	cancel = client.load(obsolete, () => cancel());
	while (pending.length) pending.shift()?.();
	expect(obsolete).not.toHaveBeenCalled();
});
