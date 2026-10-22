import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { type Heirloom, HeirloomsClient } from "./heirlooms-client";

afterEach(() => vi.unstubAllGlobals());
function setup(count = 45) {
	vi.stubGlobal("SteamDeckUIConfig", {});
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (job: () => void) => {
			pending.push(job);
			return () => {
				const index = pending.indexOf(job);
				if (index >= 0) pending.splice(index, 1);
			};
		},
		delay: (_seconds: number, job: () => void) => {
			pending.push(job);
			return () => {};
		},
	};
	const api = {
		SetSearch: vi.fn(),
		SetClassAndSpecFilters: vi.fn(),
		GetNumDisplayedHeirlooms: () => count,
		GetHeirloomItemIDFromDisplayedIndex: (index: number) => index,
		GetHeirloomInfo: (id: number) => [
			`Heirloom ${id}`,
			"INVTYPE_CHEST",
			false,
			100 + id,
			2,
			"Dungeon",
			false,
			70,
			1,
			70,
		],
		PlayerHasHeirloom: (id: number) => id % 2 === 1,
		CreateHeirloom: vi.fn(),
		GetHeirloomLink: (id: number) => `item:${id}:upgraded`,
	};
	vi.stubGlobal("C_Heirloom", api);
	vi.stubGlobal("C_HeirloomInfo", {
		SetDefaultFilters: vi.fn(),
		SetAllCollectionFilters: vi.fn(),
		SetAllSourceFilters: vi.fn(),
	});
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("UNSPECIFIED_CLASS_FILTER", 0);
	vi.stubGlobal("UNSPECIFIED_SPEC_FILTER", 0);
	const client = new HeirloomsClient(scheduler, new CollectionCache(scheduler));
	return {
		client,
		api,
		pending,
		flush: () => {
			while (pending.length) pending.shift()?.();
		},
	};
}
it("warms heirlooms in bounded batches including uncollected entries and reuses the cache", () => {
	const { client, pending, api, flush } = setup();
	const read = vi.spyOn(api, "GetHeirloomInfo");
	const publish = vi.fn();
	client.prefetch();
	client.load(publish);
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(20);
	flush();
	const rows: Heirloom[] = publish.mock.lastCall?.at(0);
	expect(rows).toHaveLength(45);
	expect(rows.at(1)).toMatchObject({
		id: 2,
		collected: false,
		upgradeLevel: 2,
		maxLevel: 70,
		link: "item:2:upgraded",
	});
	read.mockClear();
	client.load(vi.fn());
	flush();
	expect(read).not.toHaveBeenCalled();
});
it("searches and filters without losing the cached catalogue and refreshes upgrades", () => {
	const { client, api, flush } = setup(3);
	client.prefetch();
	flush();
	client.search("heirloom 2");
	const publish = vi.fn();
	client.load(publish);
	flush();
	expect(publish.mock.lastCall?.at(0).map((row: Heirloom) => row.id)).toEqual([
		2,
	]);
	client.toggleFilter("uncollected");
	flush();
	expect(publish.mock.lastCall?.at(0)).toEqual([]);
	client.search("");
	client.toggleFilter("uncollected");
	flush();
	expect(publish.mock.lastCall?.at(0)).toHaveLength(3);
	api.GetHeirloomInfo = (id) => [
		`Upgraded ${id}`,
		"INVTYPE_CHEST",
		false,
		101,
		4,
		"Dungeon",
		false,
		80,
		1,
		80,
	];
	client.refreshEntry(1);
	flush();
	expect(publish.mock.lastCall?.at(0).at(0)).toMatchObject({
		name: "Upgraded 1",
		upgradeLevel: 4,
	});
});
it("creates only collected heirlooms outside combat", () => {
	const { client, api } = setup();
	client.create(1);
	client.create(2);
	expect(api.CreateHeirloom).toHaveBeenCalledExactlyOnceWith(1);
	vi.stubGlobal("InCombatLockdown", () => true);
	client.create(1);
	expect(api.CreateHeirloom).toHaveBeenCalledTimes(1);
});
