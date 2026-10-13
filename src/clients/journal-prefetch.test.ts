import { expect, it, vi } from "vitest";
import { JournalPrefetch } from "./journal-prefetch";
import { TieredCache } from "./tiered-cache";

it("does not retain completed persisted loads as observers of later invalidations", () => {
	const scheduler = { nextFrame: () => () => {} };
	const saved = new TieredCache<number[]>(
		() => ({}),
		() => 10,
		60,
		scheduler,
	);
	const scan = vi.fn((_done: (value: number[]) => void) => () => {});
	const journal = new JournalPrefetch(scheduler, scan, saved);
	journal.prefetch();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	const done = vi.fn();
	journal.load(done);
	journal.invalidate();
	scan.mock.calls.at(1)?.at(0)?.([2]);
	expect(done).toHaveBeenCalledExactlyOnceWith([1]);
	expect(scan).toHaveBeenCalledTimes(2);
});

it("publishes saved data synchronously while sharing the bounded refresh", () => {
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			pending.push(callback);
			return () => {};
		},
	};
	const saved = new TieredCache<number[]>(
		() => ({ snapshot: { value: [1], expiresAt: 0 } }),
		() => 10,
		60,
		scheduler,
	);
	const scan = vi.fn(
		(_done: (value: number[]) => void, _preview?: (value: number[]) => void) =>
			() => {},
	);
	const journal = new JournalPrefetch(scheduler, scan, saved);
	const done = vi.fn();
	const preview = vi.fn();
	journal.prefetch();
	journal.load(done, preview);
	expect(done).toHaveBeenCalledWith([1]);
	expect(scan).toHaveBeenCalledOnce();
	scan.mock.calls.at(0)?.at(1)?.([2]);
	expect(preview).not.toHaveBeenCalled();
	scan.mock.calls.at(0)?.at(0)?.([2]);
	expect(done).toHaveBeenLastCalledWith([2]);
	expect(saved.peek("snapshot")).toEqual([2]);
});

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
	const cancel = vi.fn();
	const scan = vi.fn((_done: (value: number[]) => void) => cancel);
	const cache = new JournalPrefetch<number[]>(scheduler, scan);
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	return { cache, scan, cancel, flush };
}

it("starts prefetch immediately and shares it with opening and reopening", () => {
	const { cache, scan, flush } = setup();
	cache.prefetch();
	expect(scan).toHaveBeenCalledOnce();
	const opened = vi.fn();
	cache.load(opened);
	expect(scan).toHaveBeenCalledOnce();
	scan.mock.calls.at(0)?.at(0)?.([1, 2]);
	expect(opened).toHaveBeenCalledWith([1, 2]);
	const reopened = vi.fn();
	cache.load(reopened);
	expect(reopened).not.toHaveBeenCalled();
	flush();
	expect(reopened).toHaveBeenCalledWith([1, 2]);
	expect(scan).toHaveBeenCalledOnce();
});

it("finishes a direct load after closing and caches it for reopening", () => {
	const { cache, scan, cancel, flush } = setup();
	const closed = vi.fn();
	cache.load(closed)();
	expect(cancel).not.toHaveBeenCalled();
	scan.mock.calls.at(0)?.at(0)?.([1, 2]);
	expect(closed).not.toHaveBeenCalled();
	const reopened = vi.fn();
	cache.load(reopened);
	flush();
	expect(reopened).toHaveBeenCalledWith([1, 2]);
	expect(scan).toHaveBeenCalledOnce();
});

it("finishes invalidated refreshes while hidden and caches the latest revision", () => {
	const { cache, scan, cancel, flush } = setup();
	cache.prefetch();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	cache.invalidate();
	const closed = vi.fn();
	cache.load(closed)();
	cache.invalidate();
	cache.invalidate();
	scan.mock.calls.at(1)?.at(0)?.([2]);
	expect(scan).toHaveBeenCalledTimes(3);
	scan.mock.calls.at(2)?.at(0)?.([3]);
	expect(cancel).not.toHaveBeenCalled();
	expect(closed).not.toHaveBeenCalled();
	const reopened = vi.fn();
	cache.load(reopened);
	flush();
	expect(reopened).toHaveBeenCalledWith([3]);
	expect(scan).toHaveBeenCalledTimes(3);
});

it("coalesces invalidations and refreshes a completed cache without opening a panel", () => {
	const { cache, scan, flush } = setup();
	cache.prefetch();
	cache.invalidate();
	cache.invalidate();
	expect(scan).toHaveBeenCalledOnce();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	expect(scan).toHaveBeenCalledTimes(2);
	scan.mock.calls.at(1)?.at(0)?.([2]);
	cache.invalidate();
	cache.invalidate();
	expect(scan).toHaveBeenCalledTimes(3);
	scan.mock.calls.at(2)?.at(0)?.([3]);
	expect(scan).toHaveBeenCalledTimes(4);
	scan.mock.calls.at(3)?.at(0)?.([4]);
	const opened = vi.fn();
	cache.load(opened);
	flush();
	expect(opened).toHaveBeenCalledWith([4]);
	expect(scan).toHaveBeenCalledTimes(4);
});

it("keeps warming after a panel closes and cancels the scan on shutdown", () => {
	const { cache, scan, cancel } = setup();
	cache.prefetch();
	const done = vi.fn();
	cache.load(done)();
	expect(cancel).not.toHaveBeenCalled();
	cache.stop();
	expect(cancel).toHaveBeenCalledOnce();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	expect(done).not.toHaveBeenCalled();
	cache.prefetch();
	expect(scan).toHaveBeenCalledTimes(2);
});

it("does not deliver a queued cached snapshot after shutdown", () => {
	const { cache, scan, flush } = setup();
	cache.prefetch();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	const done = vi.fn();
	cache.load(done);
	cache.stop();
	flush();
	expect(scan).toHaveBeenCalledOnce();
	expect(done).not.toHaveBeenCalled();
});

it("ignores a stale completion after shutdown and restart", () => {
	const { cache, scan } = setup();
	cache.prefetch();
	cache.stop();
	cache.prefetch();
	const done = vi.fn();
	cache.load(done);
	scan.mock.calls.at(0)?.at(0)?.([1]);
	expect(scan).toHaveBeenCalledTimes(2);
	expect(done).not.toHaveBeenCalled();
	scan.mock.calls.at(1)?.at(0)?.([2]);
	expect(done).toHaveBeenCalledWith([2]);
});

it("rechecks invalidation before publishing a scheduled cache hit", () => {
	const { cache, scan, flush } = setup();
	cache.prefetch();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	const done = vi.fn();
	const cancel = cache.load(done);
	cache.invalidate();
	flush();
	expect(done).not.toHaveBeenCalled();
	expect(scan).toHaveBeenCalledTimes(2);
	cancel();
	scan.mock.calls.at(1)?.at(0)?.([2]);
	expect(done).not.toHaveBeenCalled();
});
