import { expect, it, vi } from "vitest";
import { type CacheEntries, TieredCache } from "./tiered-cache";

it("hydrates expired saved data immediately, coalesces refreshes and persists each item's TTL", () => {
	const saved: CacheEntries<string> = { a: { value: "old", expiresAt: 5 } };
	const pending: (() => void)[] = [];
	const read = vi.fn(() => "new");
	const cache = new TieredCache(
		() => saved,
		() => 10,
		30,
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return () => {};
			},
		},
	);
	expect(cache.get("a", read)).toBe("old");
	expect(cache.get("a", read)).toBe("old");
	expect(read).not.toHaveBeenCalled();
	expect(cache.isExpired("a")).toBe(true);
	pending.shift()?.();
	expect(read).toHaveBeenCalledOnce();
	expect(cache.peek("a")).toBe("new");
	expect(saved.a).toEqual({ value: "new", expiresAt: 40 });
	expect(cache.isExpired("a")).toBe(false);
});

it("uses memory before saved variables, reads cold misses and refreshes even fresh lookups", () => {
	const saved: CacheEntries<number> = {};
	const pending: (() => void)[] = [];
	const cache = new TieredCache(
		() => saved,
		() => 100,
		60,
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return () => {};
			},
		},
	);
	const read = vi.fn(() => 1);
	expect(cache.get("id", read)).toBe(1);
	saved.id = { value: 99, expiresAt: 200 };
	expect(cache.get("id", () => 2)).toBe(1);
	expect(read).toHaveBeenCalledOnce();
	pending.shift()?.();
	expect(cache.peek("id")).toBe(2);
});

it("cancels pending refreshes on shutdown without discarding saved entries", () => {
	const pending: (() => void)[] = [];
	const cache = new TieredCache<number>(
		() => ({}),
		() => 0,
		60,
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return () => {};
			},
		},
	);
	cache.put("id", 1);
	const read = vi.fn(() => 2);
	cache.refresh("id", read);
	cache.stop();
	pending.shift()?.();
	expect(read).not.toHaveBeenCalled();
	expect(cache.peek("id")).toBe(1);
});

it("limits refresh bursts to twenty item lookups per frame", () => {
	const pending: (() => void)[] = [];
	const cache = new TieredCache<number>(
		() => ({}),
		() => 0,
		60,
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return () => {};
			},
		},
	);
	const read = vi.fn(() => 1);
	for (let id = 0; id < 45; id++) cache.refresh(`${id}`, read);
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(20);
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(40);
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(45);
});
