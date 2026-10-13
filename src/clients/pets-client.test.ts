import { afterEach, expect, it, vi } from "vitest";
import { CollectionCache } from "./collection-cache";
import { PetsClient } from "./pets-client";

afterEach(() => vi.unstubAllGlobals());
function setup(count = 45) {
	let now = 100;
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
		SetDefaultFilters: vi.fn(),
		ClearSearchFilter: vi.fn(),
		GetNumPets: vi.fn(() => [count, count]),
		GetPetInfoByIndex: vi.fn((index: number) => [
			`Pet-${index}`,
			39,
			true,
			undefined,
			1,
			false,
			false,
			`Pet ${index}`,
			123,
		]),
		GetPetInfoByPetID: vi.fn(() => [
			39,
			"Renamed",
			1,
			0,
			0,
			0,
			true,
			"Cat",
			123,
		]),
		PetIsSummonable: vi.fn(() => true),
		SummonPetByGUID: vi.fn(),
		SummonRandomPet: vi.fn(),
		SetFavorite: vi.fn(),
	};
	vi.stubGlobal("C_PetJournal", api);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("SteamDeckUIConfig", {});
	const client = new PetsClient(
		scheduler,
		new CollectionCache(scheduler, () => now),
	);
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	return {
		client,
		api,
		pending,
		flush,
		setNow: (value: number) => {
			now = value;
		},
	};
}

it("does not extend unrelated item TTLs during targeted refreshes", () => {
	const { client, api, flush, setNow } = setup(2);
	client.load(vi.fn());
	flush();
	setNow(3500);
	client.invalidate("Pet-2");
	client.load(vi.fn());
	flush();
	api.GetPetInfoByPetID.mockClear();
	setNow(3800);
	client.invalidate("Pet-2");
	client.load(vi.fn());
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledWith("Pet-1");
	expect(api.GetPetInfoByPetID).toHaveBeenCalledTimes(2);
});

it("keeps unowned species cached without querying them as owned GUIDs", () => {
	const { client, api, flush, setNow } = setup(2);
	api.GetPetInfoByIndex.mockImplementation((index) => [
		index === 1 ? undefined : "Pet-2",
		40,
		index !== 1,
		undefined,
		1,
		false,
		false,
		"Cat",
		123,
	]);
	client.load(vi.fn());
	flush();
	setNow(3800);
	client.invalidate("Pet-2");
	client.load(vi.fn());
	flush();
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
});
it("prefetches twenty pets per frame, previews early and reuses unchanged snapshots", () => {
	const { client, api, pending, flush } = setup();
	const done = vi.fn(),
		preview = vi.fn();
	client.load(done, undefined, preview);
	pending.shift()?.();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(20);
	expect(preview.mock.lastCall?.at(0)).toHaveLength(20);
	expect(done).not.toHaveBeenCalled();
	flush();
	expect(done.mock.lastCall?.at(0)).toHaveLength(45);
	expect(api.GetNumPets).toHaveBeenCalledOnce();
	client.load(done);
	flush();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(45);
	expect(api.SetDefaultFilters).toHaveBeenCalledOnce();
});
it("refreshes only a changed GUID and preserves duplicate species identities", () => {
	const { client, api, flush } = setup(2);
	const done = vi.fn();
	client.load(done);
	flush();
	client.invalidate("Pet-2");
	client.load(done);
	flush();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(2);
	expect(api.GetPetInfoByPetID).toHaveBeenCalledExactlyOnceWith("Pet-2");
	expect(
		done.mock.lastCall?.at(0).map((pet: { id: string }) => pet.id),
	).toEqual(["Pet-1", "Pet-2"]);
	expect(done.mock.lastCall?.at(0).at(1)).toMatchObject({
		name: "Renamed",
		favourite: true,
	});
});
it("rescans membership for list changes and stops the latest continuation", () => {
	const { client, api, pending, flush } = setup();
	client.prefetch();
	pending.shift()?.();
	client.stop();
	flush();
	expect(api.GetPetInfoByIndex).toHaveBeenCalledTimes(20);
	client.prefetch();
	flush();
	api.GetNumPets.mockReturnValue([1, 1]);
	client.invalidate();
	const done = vi.fn();
	client.load(done);
	flush();
	expect(done.mock.lastCall?.at(0)).toHaveLength(1);
});
it("summons collected GUIDs and a random favourite, and guards combat and unowned actions", () => {
	const { client, api, flush } = setup(1);
	client.load(vi.fn());
	flush();
	client.summon("Pet-1");
	client.summon("species-39");
	client.summonFavourite();
	client.toggleFavourite("Pet-1");
	expect(api.SummonPetByGUID).toHaveBeenCalledExactlyOnceWith("Pet-1");
	expect(api.SummonRandomPet).toHaveBeenCalledExactlyOnceWith(true);
	expect(api.SetFavorite).toHaveBeenCalledExactlyOnceWith("Pet-1", 0);
	vi.stubGlobal("InCombatLockdown", () => true);
	client.summon("Pet-1");
	client.summonFavourite();
	expect(api.SummonPetByGUID).toHaveBeenCalledOnce();
	expect(api.SummonRandomPet).toHaveBeenCalledOnce();
});
