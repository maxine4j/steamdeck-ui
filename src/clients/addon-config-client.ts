export interface IAddonConfigClient {
	getCurrencyFavourites(): readonly number[];
	setCurrencyFavourite(id: number, favourite: boolean): void;
}

declare global {
	var SteamDeckUIConfig:
		| {
				currencyFavourites?: number[];
				collectionCache?: {
					version: number;
					updatedAt?: Record<string, number | undefined>;
					namespaces: Record<string, unknown>;
				};
		  }
		| undefined;
}

export class AddonConfigClient implements IAddonConfigClient {
	getCurrencyFavourites(): readonly number[] {
		return [...this.config().currencyFavourites];
	}
	setCurrencyFavourite(id: number, favourite: boolean): void {
		const config = this.config();
		if (favourite) {
			if (!config.currencyFavourites.includes(id))
				config.currencyFavourites.push(id);
		} else
			config.currencyFavourites = config.currencyFavourites.filter(
				(value) => value !== id,
			);
	}
	private config(): { currencyFavourites: number[] } {
		SteamDeckUIConfig ??= {};
		SteamDeckUIConfig.currencyFavourites ??= [];
		return SteamDeckUIConfig as { currencyFavourites: number[] };
	}
}
