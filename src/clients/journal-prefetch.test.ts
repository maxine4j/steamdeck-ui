import { expect, it, vi } from "vitest";
import { JournalPrefetch } from "./journal-prefetch";

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

it("coalesces invalidations during warming and leaves hidden completed caches dirty", () => {
	const { cache, scan } = setup();
	cache.prefetch();
	cache.invalidate();
	cache.invalidate();
	expect(scan).toHaveBeenCalledOnce();
	scan.mock.calls.at(0)?.at(0)?.([1]);
	expect(scan).toHaveBeenCalledTimes(2);
	scan.mock.calls.at(1)?.at(0)?.([2]);
	cache.invalidate();
	cache.invalidate();
	expect(scan).toHaveBeenCalledTimes(2);
	cache.load(vi.fn());
	expect(scan).toHaveBeenCalledTimes(3);
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
