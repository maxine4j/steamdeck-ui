import { afterEach, expect, it, vi } from "vitest";
import { ToysClient } from "./toys-client";

afterEach(() => vi.unstubAllGlobals());

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

it("bounds enumeration per frame and cancels work without publishing partial collections", () => {
	const { client, pending } = setup(45);
	const done = vi.fn();
	const cancel = client.load(done);
	pending.shift()?.();
	expect(done).not.toHaveBeenCalled();
	expect(pending).toHaveLength(1);
	cancel();
	while (pending.length) pending.shift()?.();
	expect(done).not.toHaveBeenCalled();
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
});
