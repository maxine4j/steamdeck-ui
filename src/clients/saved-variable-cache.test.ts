import { expect, it, vi } from "vitest";
import { type CacheEntries, SavedVariableCache } from "./saved-variable-cache";

function setup() {
	const saved: CacheEntries<number> = {};
	const pending: (() => void)[] = [];
	const cache = new SavedVariableCache(() => saved, {
		nextFrame: (callback) => {
			pending.push(callback);
			return () => {};
		},
	});
	return { saved, pending, cache };
}

it("uses SavedVariables as the only source of cached values", () => {
	const { saved, cache } = setup();
	cache.put("id", 1);
	Object.assign(saved, { id: { value: 99, expiresAt: 0 } });
	const read = vi.fn(() => 2);
	expect(cache.peek("id")).toBe(99);
	expect(cache.get("id", read)).toBe(99);
	expect(read).not.toHaveBeenCalled();
	expect(saved.id).toEqual({ value: 99 });
});

it("publishes page changes after persisting every entry and supports detaching", () => {
	const { saved, cache } = setup();
	const changed = vi.fn(() => {
		expect(saved.a?.value).toBe(1);
		expect(saved.b?.value).toBe(2);
	});
	const detach = cache.subscribe(changed);
	cache.putMany([
		{ key: "a", value: 1 },
		{ key: "b", value: 2 },
	]);
	expect(changed).toHaveBeenCalledOnce();
	expect(cache.values()).toEqual([1, 2]);
	detach();
	cache.put("a", 3);
	expect(changed).toHaveBeenCalledOnce();
});

it("bounds explicit refreshes and cancels continuations without losing saved entries", () => {
	const { cache, pending } = setup();
	const read = vi.fn(() => 1);
	for (let id = 0; id < 45; id++) cache.refresh(String(id), read);
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(20);
	expect(cache.values()).toHaveLength(20);
	cache.stop();
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(20);
	expect(cache.peek("0")).toBe(1);
});

it("makes page writes available to later reads while notifying observers once at the page boundary", () => {
	const { cache } = setup();
	const observer = vi.fn();
	cache.subscribe(observer);
	cache.batch(() => {
		cache.put("a", 1);
		expect(cache.peek("a")).toBe(1);
		cache.put("b", (cache.peek("a") ?? 0) + 1);
		expect(observer).not.toHaveBeenCalled();
	});
	expect(observer).toHaveBeenCalledOnce();
	expect(cache.values()).toEqual([1, 2]);
});
