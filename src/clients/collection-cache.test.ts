import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";

afterEach(() => vi.unstubAllGlobals());

it("persists versioned plain records across sessions and isolates character data", () => {
	vi.stubGlobal("SteamDeckUIConfig", { currencyFavourites: [1] });
	const scheduler = { nextFrame: vi.fn() };
	new CollectionCache(
		scheduler,
		() => 100,
		() => "one",
	)
		.create<number>("mounts")
		.put("1", 42);
	new CollectionCache(
		scheduler,
		() => 100,
		() => "one",
	)
		.create<number>("achievements", true)
		.put("1", 7);
	const next = new CollectionCache(
		scheduler,
		() => 200,
		() => "two",
	);
	expect(next.create<number>("mounts").peek("1")).toBe(42);
	expect(next.create<number>("achievements", true).peek("1")).toBeUndefined();
	expect(SteamDeckUIConfig?.currencyFavourites).toEqual([1]);
});
