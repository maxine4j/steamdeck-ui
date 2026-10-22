export interface SkyridingState {
	readonly active: boolean;
	readonly speed: number;
	readonly cruisingSpeed: number;
	readonly maximumSpeed: number;
}

export interface ISkyridingClient {
	read(): SkyridingState;
}

const fullSpeedInstances = [2444, 2454, 2548, 2549, 2516];
const raceAura = 369968;
const fullBoostSpeed = 100;
const reducedBoostSpeed = 85;
const cruisingFraction = 0.65;

export class SkyridingClient implements ISkyridingClient {
	read(): SkyridingState {
		const [isGliding, canGlide, speed] = C_PlayerInfo.GetGlidingInfo();
		const active = isGliding && canGlide && IsMounted();
		if (!active)
			return {
				active: false,
				speed: 0,
				cruisingSpeed: reducedBoostSpeed * cruisingFraction,
				maximumSpeed: reducedBoostSpeed,
			};
		const [, , , , , , , instance] = GetInstanceInfo();
		// Current Retail limits and instance exceptions: DragonRider Speedometer.lua
		// (bc7dca5, 2026-04-05), updateSpeed; DragonRider.lua, DragonRidingZoneIDs.
		const fullSpeedRegion = fullSpeedInstances.includes(instance);
		const race = !C_Secrets.ShouldSpellCooldownBeSecret(raceAura)
			? C_UnitAuras.GetPlayerAuraBySpellID(raceAura)
			: undefined;
		const maximumSpeed =
			fullSpeedRegion || race ? fullBoostSpeed : reducedBoostSpeed;
		return {
			active,
			speed: Math.max(0, speed),
			cruisingSpeed: maximumSpeed * cruisingFraction,
			maximumSpeed,
		};
	}
}
