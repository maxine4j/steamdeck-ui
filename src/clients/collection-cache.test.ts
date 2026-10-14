import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";

afterEach(() => vi.unstubAllGlobals());

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
