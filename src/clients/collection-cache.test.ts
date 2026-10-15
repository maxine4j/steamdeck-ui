import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";

afterEach(() => vi.unstubAllGlobals());

it("reports namespace size, queued work and persisted last-write age without scanning journals", () => {
	vi.stubGlobal("SteamDeckUIConfig", undefined);
	let time = 100;
	const cache = new CollectionCache(
		{ nextFrame: vi.fn() },
		() => "player",
		() => time,
	);
	const mounts = cache.create<number>("mounts");
	mounts.put("1", 42);
	time = 110;
	mounts.put("2", 43);
	expect(cache.stats()).toEqual([
		expect.objectContaining({
			namespace: "mounts",
			entries: 2,
			updatedAt: 110,
			pending: 0,
		}),
	]);
	const reopened = new CollectionCache(
		{ nextFrame: vi.fn() },
		() => "player",
		() => 120,
	);
	reopened.create("mounts");
	expect(reopened.stats().at(0)?.updatedAt).toBe(110);
});

it("persists versioned plain records across sessions and isolates character data", () => {
	vi.stubGlobal("SteamDeckUIConfig", { currencyFavourites: [1] });
	const scheduler = { nextFrame: vi.fn() };
	new CollectionCache(scheduler, () => "one")
		.create<number>("mounts")
		.put("1", 42);
	new CollectionCache(scheduler, () => "one")
		.create<number>("achievements", true)
		.put("1", 7);
	const next = new CollectionCache(scheduler, () => "two");
	expect(next.create<number>("mounts").peek("1")).toBe(42);
	expect(next.create<number>("achievements", true).peek("1")).toBeUndefined();
	expect(SteamDeckUIConfig?.currencyFavourites).toEqual([1]);
});

it("resolves WoW's loaded SavedVariables lazily and shares namespace observers", () => {
	const scheduler = { nextFrame: vi.fn() };
	vi.stubGlobal("SteamDeckUIConfig", undefined);
	const factory = new CollectionCache(scheduler);
	const first = factory.create<number>("mounts");
	expect(SteamDeckUIConfig).toBeUndefined();
	vi.stubGlobal("SteamDeckUIConfig", {
		collectionCache: {
			version: 1,
			namespaces: { mounts: { "1": { value: 7, expiresAt: 0 } } },
		},
	});
	expect(first.peek("1")).toBe(7);
	const observer = vi.fn();
	first.subscribe(observer);
	factory.create<number>("mounts").put("1", 8);
	expect(observer).toHaveBeenCalledExactlyOnceWith([{ key: "1", value: 8 }]);
	expect(first.peek("1")).toBe(8);
	expect(scheduler.nextFrame).not.toHaveBeenCalled();
});

it("migrates obsolete journal snapshots without discarding authoritative item records", () => {
	vi.stubGlobal("SteamDeckUIConfig", {
		currencyFavourites: [7],
		collectionCache: {
			version: 1,
			namespaces: {
				"mounts.snapshot": { snapshot: { value: ["old"] } },
				"toys.snapshot": { snapshot: { value: ["old"] } },
				"pets.snapshot": { snapshot: { value: ["old"] } },
				"pets.items": { "Pet-1": { value: 42 } },
				"achievements.categories:player": { "1": { value: 7 } },
			},
		},
	});
	const cache = new CollectionCache({ nextFrame: vi.fn() }, () => "player");
	expect(cache.create<number>("pets.items").peek("Pet-1")).toBe(42);
	expect(
		Object.keys(SteamDeckUIConfig?.collectionCache?.namespaces ?? {}),
	).toEqual(["pets.items", "achievements.categories:player"]);
	expect(cache.create<number>("achievements.categories", true).peek("1")).toBe(
		7,
	);
	expect(SteamDeckUIConfig?.currencyFavourites).toEqual([7]);
});
