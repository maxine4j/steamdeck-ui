import { afterEach, expect, it, vi } from "vitest";
import { AppearancesClient } from "./appearances-client";
import { CollectionCache } from "./collection-cache";

afterEach(() => vi.unstubAllGlobals());

function setup() {
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
	vi.stubGlobal("SteamDeckUIConfig", {});
	vi.stubGlobal("C_PaperDollInfo", { GetInventorySlotInfo: () => [1, 123] });
	const appearances = vi.fn((category: number) =>
		Array.from({ length: 45 }, (_, index) => ({
			visualID: category * 100 + index,
			isCollected: true,
		})),
	);
	const sources = vi.fn((id: number) => [
		{
			visualID: id,
			sourceID: id + 1000,
			itemID: id + 2000,
			categoryID: Math.floor(id / 100),
			isCollected: true,
			name: `Appearance ${id}`,
		},
	]);
	const sourceInfo = vi.fn((id: number) => sources(id - 1000).at(0));
	const defaults = vi.fn();
	const search = vi.fn(() => true);
	vi.stubGlobal("C_TransmogCollection", {
		GetCategoryAppearances: appearances,
		GetAppearanceSources: sources,
		GetSourceInfo: sourceInfo,
		SetDefaultFilters: defaults,
		SetSearch: search,
	});
	vi.stubGlobal("C_Item", {
		GetItemInfo: (id: number) => [
			`Item ${id}`,
			`item:${id}`,
			3,
			0,
			0,
			"",
			"",
			0,
			"",
			123,
			0,
			0,
			0,
			0,
			7,
		],
		RequestLoadItemDataByID: vi.fn(),
	});
	const client = new AppearancesClient(
		scheduler,
		new CollectionCache(scheduler, () => "player"),
	);
	const flush = () => {
		let steps = 0;
		while (pending.length) {
			if (++steps > 1000) throw Error("Scan did not finish");
			pending.shift()?.();
		}
	};
	return {
		client,
		appearances,
		sources,
		sourceInfo,
		pending,
		flush,
		defaults,
		search,
	};
}

it("does no login/event warming until a slot opens; shares its bounded scan and persists pages while hidden", () => {
	const { client, appearances, sources, pending, flush } = setup();
	client.refresh();
	flush();
	expect(appearances).not.toHaveBeenCalled();
	const done = vi.fn();
	const detach = client.load(1, done);
	client.load(1, vi.fn())();
	expect(appearances).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(appearances).toHaveBeenCalledExactlyOnceWith(1);
	expect(sources).toHaveBeenCalledTimes(20);
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done.mock.lastCall?.at(1)).toBe(false);
	detach();
	const calls = done.mock.calls.length;
	flush();
	expect(done).toHaveBeenCalledTimes(calls);
	const warm = vi.fn();
	client.load(1, warm)();
	expect(warm.mock.lastCall?.at(0)).toHaveLength(45);
	expect(warm.mock.lastCall?.at(1)).toBe(true);
	flush();
	expect(appearances).toHaveBeenCalledOnce();
	client.load(3, vi.fn())();
	flush();
	expect(appearances).toHaveBeenLastCalledWith(2);
});

it("updates targeted sources without rescanning and only scans opened slots on context-free events", () => {
	const { client, appearances, sources, sourceInfo, flush } = setup();
	const changed = vi.fn();
	client.load(1, vi.fn(), undefined, changed);
	flush();
	appearances.mockClear();
	sources.mockClear();
	changed.mockClear();
	client.refresh(1100);
	flush();
	expect(sourceInfo).toHaveBeenCalledWith(1100);
	expect(appearances).not.toHaveBeenCalled();
	expect(sources).toHaveBeenCalledWith(100, 1);
	sources.mockClear();
	client.refresh(undefined, 101);
	flush();
	expect(sources).toHaveBeenCalledExactlyOnceWith(101, 1);
	expect(appearances).not.toHaveBeenCalled();
	client.refresh();
	client.refresh();
	flush();
	expect(appearances).toHaveBeenCalledExactlyOnceWith(1);
	client.refresh(1300);
	flush();
	expect(appearances).toHaveBeenCalledOnce();
});

it("renders saved entries synchronously while deferring session warming until that slot opens, and cancels on shutdown", () => {
	const { client, appearances, pending, flush } = setup();
	client.load(1, vi.fn())();
	flush();
	client.stop();
	appearances.mockClear();
	const warm = vi.fn();
	client.load(1, warm)();
	expect(warm.mock.lastCall?.at(0)).toHaveLength(45);
	expect(warm.mock.lastCall?.at(1)).toBe(false);
	expect(appearances).not.toHaveBeenCalled();
	flush();
	expect(appearances).toHaveBeenCalledExactlyOnceWith(1);
	appearances.mockClear();
	client.load(5, vi.fn());
	expect(pending.length).toBeGreaterThan(0);
	client.stop();
	flush();
	expect(appearances).not.toHaveBeenCalled();
});

it("resolves item data through targeted updates and retains a single visual for multiple sources", () => {
	const { client, sources, appearances, flush } = setup();
	let ready = false;
	vi.stubGlobal("C_Item", {
		GetItemInfo: () =>
			ready
				? ["Loaded", "item:2100", 3, 0, 0, "", "", 0, "", 999, 0, 0, 0, 0, 10]
				: [],
		RequestLoadItemDataByID: vi.fn(),
	});
	sources.mockImplementation((id: number) => [
		{
			visualID: id,
			sourceID: id + 1000,
			itemID: id + 2000,
			categoryID: 1,
			isCollected: false,
			name: "Uncollected",
		},
		{
			visualID: id,
			sourceID: id + 3000,
			itemID: id + 4000,
			categoryID: 1,
			isCollected: true,
			name: "Collected",
		},
	]);
	const done = vi.fn();
	client.load(1, done);
	flush();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(done.mock.lastCall?.at(0).at(0)).toMatchObject({
		id: 100,
		sourceId: 3100,
		itemId: 4100,
		name: "Collected",
		collected: true,
	});
	appearances.mockClear();
	ready = true;
	client.refreshItem(4100);
	flush();
	expect(appearances).not.toHaveBeenCalled();
	expect(done.mock.lastCall?.at(0).at(0)).toMatchObject({
		name: "Loaded",
		icon: 999,
		expansionId: 10,
	});
});

it("leaves unopened slots dormant on targeted events and scans only weapon categories valid for the opened hand", () => {
	const { client, sourceInfo, appearances, flush } = setup();
	client.refresh(1100);
	flush();
	expect(sourceInfo).not.toHaveBeenCalled();
	vi.stubGlobal("C_TransmogCollection", {
		GetCategoryAppearances: appearances,
		GetAppearanceSources: () => [],
		GetSourceInfo: sourceInfo,
		SetDefaultFilters: vi.fn(),
		SetSearch: vi.fn(),
		GetCategoryInfo: (category: number) => [
			"Weapon",
			true,
			false,
			category === 14 || category === 25,
			category === 18,
		],
	});
	client.load(17, vi.fn())();
	flush();
	expect(appearances).toHaveBeenCalledExactlyOnceWith(18);
	appearances.mockClear();
	client.load(16, vi.fn())();
	flush();
	expect(appearances.mock.calls.map((call) => call.at(0))).toEqual([14, 25]);
});

it("clears inherited native filters only on the first opened-slot scan, without scan loops from filter events", () => {
	const { client, defaults, search, appearances, flush } = setup();
	defaults.mockImplementation(() => client.refresh());
	client.refresh();
	flush();
	expect(defaults).not.toHaveBeenCalled();
	client.load(1, vi.fn())();
	flush();
	expect(defaults).toHaveBeenCalledOnce();
	expect(search).toHaveBeenCalledWith(1, "");
	expect(appearances).toHaveBeenCalledOnce();
	client.load(3, vi.fn())();
	flush();
	expect(defaults).toHaveBeenCalledOnce();
});
