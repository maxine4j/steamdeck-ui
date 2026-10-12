import { afterEach, expect, it, vi } from "vitest";
import { MountsClient } from "./mounts-client";

const scheduler = { nextFrame: vi.fn(() => vi.fn()) };

afterEach(() => vi.unstubAllGlobals());
it("summons by journal ID and picks up the random favourite action", () => {
	const summon = vi.fn();
	const pickup = vi.fn();
	vi.stubGlobal("C_MountJournal", { SummonByID: summon, Pickup: pickup });
	const client = new MountsClient(scheduler);
	client.summon(42);
	client.summon(0);
	client.pickupRandom();
	expect(summon.mock.calls).toEqual([[42], [0]]);
	expect(pickup).toHaveBeenCalledExactlyOnceWith(0);
});
it("routes search and each filter group to the journal and retains the equipment confirmation flow", () => {
	const collection = vi.fn();
	const type = vi.fn();
	const source = vi.fn();
	const search = vi.fn();
	vi.stubGlobal("C_MountJournal", {
		GetCollectedFilterSetting: () => true,
		IsValidTypeFilter: () => true,
		IsTypeChecked: () => false,
		IsValidSourceFilter: () => true,
		IsSourceChecked: () => true,
		SetCollectedFilterSetting: collection,
		SetTypeFilter: type,
		SetSourceFilter: source,
		SetSearch: search,
	});
	vi.stubGlobal("C_PetJournal", { GetNumPetSources: () => 12 });
	const client = new MountsClient(scheduler);
	client.search("horse");
	client.toggleFilter("collection:2");
	client.toggleFilter("type:3");
	client.toggleFilter("source:12");
	client.toggleFilter("source:999");
	expect(search).toHaveBeenCalledWith("horse");
	expect(collection).toHaveBeenCalledWith(2, false);
	expect(type).toHaveBeenCalledWith(3, true);
	expect(source).toHaveBeenCalledExactlyOnceWith(12, false);
	const apply = vi.fn();
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("C_Cursor", { GetCursorItem: () => undefined });
	vi.stubGlobal("MountJournal", {
		BottomLeftInset: { SlotButton: { ApplyEquipmentAtCursor: apply } },
	});
	client.applyEquipment();
	expect(apply).not.toHaveBeenCalled();
	vi.stubGlobal("C_Cursor", { GetCursorItem: () => ({ bag: 0, slot: 1 }) });
	client.applyEquipment();
	expect(apply).toHaveBeenCalledOnce();
});
it("uses displayed indices for favourites, preserves mount IDs and counts the full collection", () => {
	const favourite = vi.fn();
	const displayedCount = vi.fn(() => 1);
	vi.stubGlobal("C_MountJournal", {
		GetMountIDs: () => [10, 20, 30],
		GetMountInfoByID: (id: number) => [
			"Mount",
			1,
			2,
			false,
			true,
			1,
			false,
			false,
			null,
			id === 30,
			id === 10,
		],
		GetNumDisplayedMounts: displayedCount,
		GetDisplayedMountInfo: () => [
			"Horse",
			123,
			456,
			false,
			true,
			1,
			true,
			false,
			null,
			false,
			true,
			20,
		],
		GetIsFavorite: () => [true, true],
		SetIsFavorite: favourite,
	});
	const client = new MountsClient(scheduler);
	expect(client.getCount()).toEqual({ collected: 1, total: 2 });
	expect(client.getMounts()).toEqual([
		{
			id: 20,
			index: 1,
			name: "Horse",
			spell: 123,
			icon: 456,
			collected: true,
			usable: true,
			favourite: true,
		},
	]);
	client.toggleFavourite(20);
	expect(favourite).toHaveBeenCalledWith(1, false);
	client.toggleFavourite(999);
	expect(favourite).toHaveBeenCalledTimes(1);
	// One journal-size query per load, rather than one per loop iteration.
	expect(displayedCount).toHaveBeenCalledTimes(3);
});

it("loads the journal across frames and cancels an obsolete load", () => {
	const pending: (() => void)[] = [];
	const nextFrame = (callback: () => void) => {
		let cancelled = false;
		pending.push(() => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	};
	const displayed = vi.fn((index: number) => [
		`Mount ${index}`,
		123,
		456,
		false,
		true,
		1,
		false,
		false,
		null,
		index === 2,
		true,
		index,
	]);
	const info = vi.fn(() => [
		"Mount",
		123,
		456,
		false,
		true,
		1,
		false,
		false,
		null,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 45,
		GetDisplayedMountInfo: displayed,
		GetMountIDs: () => [1, 2, 3],
		GetMountInfoByID: info,
	});
	const client = new MountsClient({ nextFrame });
	const done = vi.fn();
	const progress = vi.fn();
	client.load(done, undefined, progress);
	expect(displayed).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(20);
	expect(progress).toHaveBeenLastCalledWith(20, 48);
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(40);
	pending.shift()?.();
	expect(done).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(0)).toHaveLength(44);
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 3, total: 3 });
	expect(progress).toHaveBeenLastCalledWith(48, 48);
	const obsolete = vi.fn();
	const cancel = client.load(obsolete);
	pending.shift()?.();
	const calls = displayed.mock.calls.length;
	cancel();
	pending.shift()?.();
	expect(displayed).toHaveBeenCalledTimes(calls);
	expect(obsolete).not.toHaveBeenCalled();
});

it("publishes a first page before enumeration and counting finish, without hidden mounts", () => {
	const pending: (() => void)[] = [];
	const nextFrame = (callback: () => void) => {
		let cancelled = false;
		pending.push(() => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	};
	const info = vi.fn(() => [
		"Mount",
		1,
		2,
		false,
		true,
		1,
		false,
		false,
		null,
		false,
		true,
	]);
	vi.stubGlobal("C_MountJournal", {
		GetNumDisplayedMounts: () => 65,
		GetDisplayedMountInfo: (index: number) => [
			`Mount ${index}`,
			1,
			2,
			false,
			true,
			1,
			false,
			false,
			null,
			index <= 20,
			true,
			index,
		],
		GetMountIDs: () => Array.from({ length: 100 }, (_, index) => index + 1),
		GetMountInfoByID: info,
	});
	const client = new MountsClient({ nextFrame });
	const done = vi.fn();
	const preview = vi.fn();
	client.load(done, preview);
	pending.shift()?.();
	expect(preview).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(preview).toHaveBeenCalledOnce();
	const firstPage = preview.mock.lastCall?.at(0);
	expect(firstPage).toHaveLength(20);
	expect(firstPage.at(0)?.id).toBe(21);
	expect(info).not.toHaveBeenCalled();
	expect(done).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(firstPage).toHaveLength(20);
	expect(preview).toHaveBeenCalledOnce();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(done.mock.lastCall?.at(1)).toEqual({ collected: 100, total: 100 });
	// Cancelling from the preview must also prevent scheduling more work.
	let cancel = () => {};
	const obsolete = vi.fn();
	cancel = client.load(obsolete, () => cancel());
	while (pending.length) pending.shift()?.();
	expect(obsolete).not.toHaveBeenCalled();
});
