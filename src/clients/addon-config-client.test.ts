import { afterEach, expect, it, vi } from "vitest";
import { AddonConfigClient } from "./addon-config-client";

afterEach(() => vi.unstubAllGlobals());

it("stores unique favourites across client instances and removes them without touching other configuration", () => {
	const saved = { currencyFavourites: [42], otherSetting: true };
	vi.stubGlobal("SteamDeckUIConfig", saved);
	const client = new AddonConfigClient();
	expect(client.getCurrencyFavourites()).toEqual([42]);
	client.setCurrencyFavourite(42, true);
	client.setCurrencyFavourite(9, true);
	expect(new AddonConfigClient().getCurrencyFavourites()).toEqual([42, 9]);
	client.setCurrencyFavourite(42, false);
	expect(saved).toEqual({ currencyFavourites: [9], otherSetting: true });
});

it("reads saved variables lazily after addon loading and initializes missing settings", () => {
	vi.stubGlobal("SteamDeckUIConfig", undefined);
	const client = new AddonConfigClient();
	vi.stubGlobal("SteamDeckUIConfig", { currencyFavourites: [9] });
	expect(client.getCurrencyFavourites()).toEqual([9]);
	vi.stubGlobal("SteamDeckUIConfig", undefined);
	client.setCurrencyFavourite(42, true);
	expect(new AddonConfigClient().getCurrencyFavourites()).toEqual([42]);
	vi.stubGlobal("SteamDeckUIConfig", { otherSetting: true });
	expect(client.getCurrencyFavourites()).toEqual([]);
	client.setCurrencyFavourite(9, true);
	expect(new AddonConfigClient().getCurrencyFavourites()).toEqual([9]);
});
