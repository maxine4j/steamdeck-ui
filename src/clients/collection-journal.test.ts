import { expect, it, vi } from "vitest";
import { CollectionJournal } from "./collection-journal";
import { type CacheEntries, SavedVariableCache } from "./saved-variable-cache";

interface Row {
	id: number;
	value: number;
	visible?: boolean;
}
function setup() {
	const entries: CacheEntries<Row> = {};
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
	const cache = new SavedVariableCache(() => entries, scheduler);
	let value = 1;
	const read = vi.fn((id: number) => ({ id, value }));
	const begin = vi.fn(() => ({
		count: 45,
		read: (index: number) => [read(index + 1)],
	}));
	const journal = new CollectionJournal(
		scheduler,
		cache,
		(row) => String(row.id),
		(row) => row.visible !== false,
		begin,
		(key) => [read(Number(key))],
	);
	const flush = () => {
		let steps = 0;
		while (pending.length) {
			if (++steps > 1000) throw Error("Never completed");
			pending.shift()?.();
		}
	};
	return {
		cache,
		journal,
		begin,
		read,
		pending,
		flush,
		setValue: (next: number) => {
			value = next;
		},
	};
}

it("shares cold scans, commits and notifies each bounded page, and keeps warming after closing", () => {
	const { cache, journal, read, begin, pending, flush } = setup();
	const changed = vi.fn();
	cache.subscribe(changed);
	const done = vi.fn();
	const detach = journal.load(done);
	journal.load(vi.fn())();
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(20);
	expect(cache.values()).toHaveLength(20);
	expect(changed).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done.mock.lastCall?.at(1)).toBe(false);
	detach();
	flush();
	expect(begin).toHaveBeenCalledOnce();
	expect(cache.values()).toHaveLength(45);
	expect(done).toHaveBeenCalledOnce();
	const reopened = vi.fn();
	journal.load(reopened);
	expect(reopened.mock.lastCall?.at(0)).toHaveLength(45);
	expect(pending).toHaveLength(0);
});

it("forces login warming on a populated cache and bounds targeted event bursts without a full scan", () => {
	const { cache, journal, read, begin, pending, flush } = setup();
	cache.put("1", { id: 1, value: 0 });
	const done = vi.fn();
	journal.load(done);
	expect(done.mock.lastCall?.at(0)).toEqual([{ id: 1, value: 0 }]);
	expect(pending).toHaveLength(0);
	for (let id = 1; id <= 45; id++) journal.refreshEntry(String(id));
	pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(20);
	expect(begin).not.toHaveBeenCalled();
	flush();
	expect(cache.values()).toHaveLength(45);
	journal.prefetch();
	flush();
	expect(begin).toHaveBeenCalledOnce();
});

it("coalesces early events and repeats once for events behind an active cursor", () => {
	const { journal, begin, pending, flush, setValue, cache } = setup();
	for (let event = 0; event < 10; event++) journal.refreshEntry();
	pending.shift()?.();
	setValue(2);
	for (let event = 0; event < 10; event++) journal.refreshEntry();
	flush();
	expect(begin).toHaveBeenCalledTimes(2);
	expect(cache.peek("1")?.value).toBe(2);
});

it("cancels the latest continuation and detaches old observers on shutdown while preserving completed pages", () => {
	const { journal, cache, read, pending, flush } = setup();
	const done = vi.fn();
	journal.load(done);
	pending.shift()?.();
	journal.stop();
	flush();
	expect(read).toHaveBeenCalledTimes(20);
	expect(cache.values()).toHaveLength(20);
	journal.prefetch();
	flush();
	expect(cache.values()).toHaveLength(45);
	expect(done).toHaveBeenCalledOnce();
});

it("cancels superseded projections and stores only the latest display state", () => {
	const { journal, cache, pending, flush } = setup();
	journal.prefetch();
	flush();
	journal.project(() => ({
		count: 45,
		read: (index) => [{ id: index + 1, value: 1, visible: false }],
	}));
	pending.shift()?.();
	journal.project(() => ({
		count: 45,
		read: (index) => [{ id: index + 1, value: 1, visible: true }],
	}));
	flush();
	expect(cache.values().every((row) => row.visible)).toBe(true);
});
