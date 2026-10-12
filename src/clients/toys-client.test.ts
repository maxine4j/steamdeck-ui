import { afterEach, expect, it, vi } from "vitest";
import { ToysClient } from "./toys-client";

afterEach(() => vi.unstubAllGlobals());

it("keeps every toy when startup prefetch runs before toy names are cached", () => {
	const { client, api, pending } = setup(25);
	api.GetToyInfo = (id) =>
		id <= 4
			? [id, `Toy ${id}`, 100 + id, true]
			: [id, undefined, 100 + id, false];
	client.prefetch();
	while (pending.length) pending.shift()?.();
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(25);
	expect(done.mock.lastCall?.at(0).at(4)).toMatchObject({
		id: 5,
		name: "Toy 5",
		icon: 105,
	});
});

it("prefetches in twenty-entry batches and reuses the snapshot on opening", () => {
	const { client, api, pending } = setup(45);
	const info = vi.spyOn(api, "GetToyInfo");
	client.prefetch();
	expect(info).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(20);
	const done = vi.fn();
	client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(40);
	pending.shift()?.();
	expect(done).toHaveBeenCalledOnce();
	client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(45);
	expect(done).toHaveBeenCalledTimes(2);
});

it("passes item cooldown values through without arithmetic", () => {
	const { client } = setup();
	vi.stubGlobal("C_Container", {
		GetItemCooldown: vi.fn(() => [10, 60, true]),
	});
	expect(client.getCooldown(42)).toEqual({ start: 10, duration: 60 });
	expect(C_Container.GetItemCooldown).toHaveBeenCalledExactlyOnceWith(42);
});

function setup(count = 2) {
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
	const api = {
		GetNumFilteredToys: () => count,
		GetToyFromIndex: (index: number) => index,
		GetToyInfo: (id: number) => [id, `Toy ${id}`, 100 + id, id === 1],
		GetIsFavorite: () => true,
		SetIsFavorite: vi.fn(),
		IsToyUsable: () => true,
	};
	vi.stubGlobal("C_ToyBox", api);
	vi.stubGlobal("PlayerHasToy", (id: number) => id !== 2);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("C_Item", {
		GetItemInfo: (id: number) => [
			`Toy ${id}`,
			`item:${id}`,
			1,
			0,
			0,
			"",
			"",
			1,
			"",
			100,
			0,
			0,
			0,
			0,
			10,
		],
		RequestLoadItemDataByID: vi.fn(),
	});
	return { api, pending, client: new ToysClient(scheduler) };
}

it("converts journal entries and item expansion metadata without using native frames", () => {
	const { client, pending } = setup();
	const done = vi.fn();
	client.load(done);
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(done).toHaveBeenCalledExactlyOnceWith([
		{
			id: 1,
			name: "Toy 1",
			icon: 101,
			favourite: true,
			collected: true,
			expansionId: 10,
		},
		{
			id: 2,
			name: "Toy 2",
			icon: 102,
			favourite: false,
			collected: false,
			expansionId: 10,
		},
	]);
});

it("finishes bounded enumeration after closing and reuses the cache on reopening", () => {
	const { client, api, pending } = setup(45);
	const info = vi.spyOn(api, "GetToyInfo");
	const done = vi.fn();
	const cancel = client.load(done);
	pending.shift()?.();
	expect(info).toHaveBeenCalledTimes(20);
	expect(done).not.toHaveBeenCalled();
	expect(pending).toHaveLength(1);
	cancel();
	while (pending.length) pending.shift()?.();
	expect(done).not.toHaveBeenCalled();
	expect(info).toHaveBeenCalledTimes(45);
	client.load(done);
	pending.shift()?.();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(info).toHaveBeenCalledTimes(45);
});

it("reports scanned entries against the total each frame, including skipped entries", () => {
	const { client, api, pending } = setup(45);
	api.GetToyFromIndex = (index) => (index === 1 ? 0 : index);
	const progress = vi.fn();
	const done = vi.fn();
	client.load(done, progress);
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(20, 45);
	expect(done).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(40, 45);
	pending.shift()?.();
	expect(progress).toHaveBeenLastCalledWith(45, 45);
	expect(done.mock.calls.at(0)?.at(0)).toHaveLength(44);
});

it("reports an empty collection and stops reporting after cancellation", () => {
	const { client, pending } = setup(0);
	const progress = vi.fn();
	const done = vi.fn();
	client.load(done, progress);
	pending.shift()?.();
	expect(progress).toHaveBeenCalledExactlyOnceWith(0, 0);
	expect(done).toHaveBeenCalledExactlyOnceWith([]);
	const cancel = client.load(done, progress);
	cancel();
	pending.shift()?.();
	expect(progress).toHaveBeenCalledTimes(1);
	expect(done).toHaveBeenCalledTimes(1);
});

it("requests missing metadata once and re-reads loaded expansion data", () => {
	const { client, pending } = setup(1);
	const request = vi.fn();
	const info = vi.fn(() => [] as unknown[]);
	vi.stubGlobal("C_Item", {
		GetItemInfo: info,
		RequestLoadItemDataByID: request,
	});
	const done = vi.fn();
	for (let i = 0; i < 2; i++) {
		client.load(done);
		pending.shift()?.();
	}
	expect(request).toHaveBeenCalledExactlyOnceWith(1);
	expect(done.mock.calls.at(-1)?.at(0).at(0).expansionId).toBeUndefined();
	info.mockReturnValue([
		"Loaded",
		"",
		0,
		0,
		0,
		"",
		"",
		0,
		"",
		0,
		0,
		0,
		0,
		0,
		11,
	]);
	client.invalidate();
	client.load(done);
	pending.shift()?.();
	expect(done.mock.calls.at(-1)?.at(0).at(0).expansionId).toBe(11);
});

it("toggles live favourite state only for collected toys and guards use eligibility", () => {
	const { client, api } = setup();
	client.toggleFavourite(1);
	expect(api.SetIsFavorite).toHaveBeenCalledExactlyOnceWith(1, false);
	client.toggleFavourite(2);
	expect(api.SetIsFavorite).toHaveBeenCalledTimes(1);
	expect(client.canUse(1)).toBe(true);
	expect(client.canUse(2)).toBe(false);
	api.IsToyUsable = () => false;
	expect(client.canUse(1)).toBe(false);
	api.IsToyUsable = () => true;
	vi.stubGlobal("InCombatLockdown", () => true);
	expect(client.canUse(1)).toBe(false);
	expect(client.isInCombat()).toBe(true);
});
