import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { type Mount, MountsClient } from "./mounts-client";

afterEach(() => vi.unstubAllGlobals());
function mount(id: number, collected = false): Mount {
	return {
		id,
		index: id,
		name: `Mount ${id}`,
		spell: id,
		icon: id,
		collected,
		usable: true,
		favourite: false,
	};
}
function setup(
	size = 45,
	performance?: { now(): number; log(message: string): void },
) {
	vi.stubGlobal("SteamDeckUIConfig", {});
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
	const cache = new CollectionCache(scheduler);
	const saved = cache.create<Mount>("mounts.items");
	const ids = Array.from({ length: size }, (_, i) => i + 1);
	const info = vi.fn((id: number) => [
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
	]);
	const api = {
		GetMountIDs: vi.fn(() => ids),
		GetMountInfoByID: info,
		GetNumDisplayedMounts: vi.fn(() => ids.length),
		GetDisplayedMountID: vi.fn((index: number) => ids.at(index - 1)),
		GetDisplayedMountInfo: vi.fn((index: number) => [
			...info(ids.at(index - 1) ?? 0),
			ids.at(index - 1),
		]),
		GetIsFavorite: vi.fn(() => [false, true]),
		SetIsFavorite: vi.fn(),
		SetSearch: vi.fn(),
		SummonByID: vi.fn(),
		Pickup: vi.fn(),
	};
	vi.stubGlobal("C_MountJournal", api);
	const client = new MountsClient(scheduler, cache, performance);
	const flush = () => {
		let steps = 0;
		while (pending.length) {
			if (++steps > 1000) throw new Error("Scan never completed");
			pending.shift()?.();
		}
	};
	return { pending, scheduler, saved, cache, client, info, api, ids, flush };
}

it("logs mount warming and broad-event repeat timings independently of other collections", () => {
	let time = 0;
	const performance = { now: () => time++, log: vi.fn() };
	const { client, pending, flush } = setup(45, performance);
	client.prefetch();
	pending.shift()?.();
	client.refreshEntry();
	flush();
	const messages = performance.log.mock.calls.map((call) => call.at(0));
	expect(
		messages.some((message) =>
			message?.includes("mounts scan start reason=login"),
		),
	).toBe(true);
	expect(
		messages.some((message) => message?.includes("reason=server-event-repeat")),
	).toBe(true);
	expect(
		messages.some(
			(message) =>
				message?.includes("journal=") && message.includes("publish="),
		),
	).toBe(true);
});

it("renders saved mounts synchronously and never scans on warm opening or reopening", () => {
	const { client, saved, info, api, pending } = setup();
	saved.put("1", mount(1));
	const done = vi.fn();
	client.load(done);
	expect(done).toHaveBeenCalledExactlyOnceWith(
		[mount(1)],
		{ collected: 0, total: 1 },
		true,
	);
	expect(client.getMounts()).toEqual([mount(1)]);
	expect(client.getCount()).toEqual({ collected: 0, total: 1 });
	client.load(done);
	expect(done).toHaveBeenCalledTimes(2);
	expect(pending).toHaveLength(0);
	expect(info).not.toHaveBeenCalled();
	expect(api.GetMountIDs).not.toHaveBeenCalled();
});

it("warms a populated cache on login and publishes every bounded page before completion", () => {
	const { client, saved, info, pending, flush } = setup();
	saved.put("1", mount(1));
	const changed = vi.fn();
	saved.subscribe(changed);
	const done = vi.fn();
	client.load(done);
	client.prefetch();
	expect(info).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(20);
	expect(saved.values()).toHaveLength(20);
	expect(changed).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 20, total: 20 });
	pending.shift()?.();
	expect(info.mock.calls.length).toBeLessThanOrEqual(40);
	flush();
	expect(saved.values()).toHaveLength(45);
	expect(client.getCount()).toEqual({ collected: 45, total: 45 });
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
});

it("starts one shared scan for a cold opening and keeps warming after the panel closes", () => {
	const { client, pending, api, saved, flush } = setup();
	const done = vi.fn();
	const detach = client.load(done);
	client.load(vi.fn())();
	pending.shift()?.();
	expect(saved.values()).toHaveLength(20);
	expect(done).toHaveBeenCalled();
	detach();
	const calls = done.mock.calls.length;
	flush();
	expect(saved.values()).toHaveLength(45);
	expect(api.GetMountIDs).toHaveBeenCalledOnce();
	expect(done).toHaveBeenCalledTimes(calls);
	const reopened = vi.fn();
	client.load(reopened);
	expect(reopened.mock.lastCall?.at(0)).toHaveLength(45);
});

it("refreshes just a supplied ID while hidden and publishes it to an open observer", () => {
	const { client, saved, info, api, flush } = setup();
	saved.put("1", mount(1));
	saved.put("42", mount(42));
	const done = vi.fn();
	const detach = client.load(done);
	client.refreshEntry(42);
	flush();
	expect(info).toHaveBeenCalledExactlyOnceWith(42);
	expect(api.GetMountIDs).not.toHaveBeenCalled();
	expect(saved.peek("42")?.collected).toBe(true);
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 1, total: 2 });
	detach();
	client.refreshEntry(1);
	flush();
	expect(client.getCount()).toEqual({ collected: 2, total: 2 });
});

it("rescans fresh entries after a context-free event without opening the panel", () => {
	const { client, saved, api, info, flush } = setup(2);
	saved.put("1", mount(1));
	saved.put("2", mount(2));
	client.refreshEntry();
	flush();
	expect(api.GetMountIDs).toHaveBeenCalledOnce();
	expect(info.mock.calls).toEqual([[1], [2]]);
	expect(client.getCount()).toEqual({ collected: 2, total: 2 });
});

it("coalesces event bursts during scans and covers changes behind the scan cursor", () => {
	const { client, saved, pending, api, info, flush } = setup();
	client.prefetch();
	pending.shift()?.();
	info.mockImplementation((id) => [
		`Mount ${id}`,
		id,
		id,
		false,
		true,
		1,
		id === 1,
		false,
		undefined,
		false,
		true,
	]);
	client.refreshEntry(1);
	for (let i = 0; i < 10; i++) client.refreshEntry();
	flush();
	expect(api.GetMountIDs).toHaveBeenCalledTimes(2);
	expect(saved.peek("1")?.favourite).toBe(true);
	expect(saved.values()).toHaveLength(45);
});

it("cancels the latest scan continuation on shutdown and retains all completed pages", () => {
	const { client, saved, pending, info, flush } = setup();
	client.prefetch();
	pending.shift()?.();
	const calls = info.mock.calls.length;
	client.stop();
	flush();
	expect(info).toHaveBeenCalledTimes(calls);
	expect(saved.values()).toHaveLength(20);
	client.prefetch();
	flush();
	expect(saved.values()).toHaveLength(45);
});

it("searches and projects Blizzard filters without rereading mount details or scanning the journal", () => {
	const { client, saved, api, info, ids, flush } = setup(2);
	saved.put("1", mount(1));
	saved.put("2", mount(2));
	const done = vi.fn();
	client.load(done);
	client.search("Mount 2");
	ids.splice(0, 1);
	client.refreshDisplay();
	flush();
	expect(api.SetSearch).toHaveBeenCalledExactlyOnceWith("Mount 2");
	expect(done.mock.lastCall?.at(0)).toEqual([{ ...mount(2), index: 1 }]);
	expect(info).not.toHaveBeenCalled();
	expect(api.GetMountIDs).not.toHaveBeenCalled();
	expect(client.getCount()).toEqual({ collected: 0, total: 2 });
});

it("retains unavailable details, excludes hidden mounts, and updates entries that become hidden", () => {
	const { client, saved, info, flush } = setup(3);
	saved.put("1", mount(1));
	info.mockImplementation((id) => [
		id === 1 ? undefined : `Mount ${id}`,
		id,
		id,
		false,
		true,
		1,
		false,
		false,
		undefined,
		id === 2,
		true,
	]);
	client.prefetch();
	flush();
	expect(saved.peek("1")).toEqual(mount(1));
	expect(client.getMounts().map((row) => row.id)).toEqual([1, 3]);
	expect(client.getCount()).toEqual({ collected: 1, total: 2 });
	info.mockImplementation((id) => [
		`Mount ${id}`,
		id,
		id,
		false,
		true,
		1,
		false,
		false,
		undefined,
		true,
		true,
	]);
	client.refreshEntry(3);
	flush();
	expect(client.getMounts().map((row) => row.id)).toEqual([1]);
});

it("persists pages for a new client without a duplicate snapshot", () => {
	const { client, cache, scheduler, flush, api } = setup(2);
	client.prefetch();
	flush();
	client.stop();
	api.GetMountIDs.mockClear();
	const next = new MountsClient(scheduler, cache);
	const done = vi.fn();
	next.load(done);
	expect(done.mock.lastCall?.at(0)).toHaveLength(2);
	expect(api.GetMountIDs).not.toHaveBeenCalled();
	expect(
		SteamDeckUIConfig?.collectionCache?.namespaces["mounts.snapshot"],
	).toBeUndefined();
});

it("routes summon and random pickup and validates current eligibility by ID", () => {
	const { client, api, info } = setup();
	client.summon(42);
	client.pickupRandom();
	expect(api.SummonByID).toHaveBeenCalledExactlyOnceWith(42);
	expect(api.Pickup).toHaveBeenCalledExactlyOnceWith(0);
	expect(client.canUse(42)).toBe(true);
	info.mockImplementation((id) => [
		`Mount ${id}`,
		id,
		id,
		false,
		false,
		1,
		false,
		false,
		undefined,
		false,
		true,
	]);
	expect(client.canUse(42)).toBe(false);
	expect(api.GetMountIDs).not.toHaveBeenCalled();
});

it("resolves reordered favourite indices with bounded ID-only lookups", () => {
	const { client, saved, api, pending, info, flush } = setup();
	saved.put("6", mount(6));
	api.GetDisplayedMountID.mockImplementation((index) =>
		index === 45 ? 6 : index + 100,
	);
	const done = vi.fn();
	client.setFavourite(6, true, done);
	expect(api.SetIsFavorite).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(api.GetDisplayedMountID.mock.calls.length).toBeLessThanOrEqual(21);
	expect(done).not.toHaveBeenCalled();
	flush();
	expect(api.SetIsFavorite).toHaveBeenCalledExactlyOnceWith(45, true);
	expect(done).toHaveBeenCalledExactlyOnceWith(true);
	expect(info).not.toHaveBeenCalled();
	client.refreshDisplay();
	flush();
	expect(info).toHaveBeenCalledExactlyOnceWith(6);
});

it("cancels favourite index lookups on shutdown", () => {
	const { client, api, flush } = setup();
	const done = vi.fn();
	client.setFavourite(999, true, done);
	client.stop();
	flush();
	expect(api.SetIsFavorite).not.toHaveBeenCalled();
	expect(done).not.toHaveBeenCalled();
});

it("detaches all old observers on shutdown, including across a restart", () => {
	const { client, saved, flush } = setup(2);
	saved.put("1", mount(1));
	const done = vi.fn();
	client.load(done);
	client.stop();
	client.prefetch();
	flush();
	expect(done).toHaveBeenCalledOnce();
});

it("persists the displayed projection in mount entries for immediate filtered reopening", () => {
	const { client, saved, cache, scheduler, ids, flush, info } = setup(2);
	saved.put("1", mount(1));
	saved.put("2", mount(2));
	ids.splice(0, 1);
	client.refreshDisplay();
	flush();
	const next = new MountsClient(scheduler, cache);
	expect(next.getMounts().map((row) => row.id)).toEqual([2]);
	expect(next.getCount()).toEqual({ collected: 0, total: 2 });
	expect(info).not.toHaveBeenCalled();
});

it("updates a collected-filter projection when a specific mount becomes collected", () => {
	const { client, saved, ids, flush } = setup(2);
	saved.put("1", mount(1, true));
	saved.put("2", { ...mount(2), index: 0 });
	ids.splice(1, 1);
	client.refreshDisplay();
	flush();
	ids.push(2);
	client.refreshEntry(2);
	flush();
	expect(client.getMounts().map((row) => row.id)).toEqual([1, 2]);
});

it("publishes incomplete scan pages and marks completion after the final page", () => {
	const { client, pending, flush } = setup();
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(2)).toBe(false);
	flush();
	expect(done.mock.lastCall?.at(2)).toBe(true);
});

it("coalesces events received before the first scan page into that scan", () => {
	const { client, api, flush } = setup(2);
	for (let event = 0; event < 10; event++) client.refreshEntry();
	flush();
	expect(api.GetMountIDs).toHaveBeenCalledOnce();
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
	const scheduler = { nextFrame: vi.fn(() => () => {}) };
	const client = new MountsClient(scheduler, new CollectionCache(scheduler));
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
