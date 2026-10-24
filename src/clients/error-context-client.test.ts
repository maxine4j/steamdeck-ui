import { afterEach, expect, it, vi } from "vitest";
import { ErrorContextClient } from "./error-context-client";

afterEach(() => vi.unstubAllGlobals());

it("snapshots instance, delve, party, player, zone and runtime state", () => {
	vi.stubGlobal("issecretvalue", () => false);
	vi.stubGlobal("_G", {
		GetInstanceInfo: () => [
			"The Dread Pit",
			"scenario",
			208,
			"Tier 8",
			5,
			0,
			false,
			2664,
			3,
		],
		IsInInstance: () => [true, "scenario"],
		C_PartyInfo: { IsDelveInProgress: () => true },
		C_DelvesUI: { GetActiveDelveTier: () => 8 },
		GetNumGroupMembers: () => 3,
		IsInRaid: () => false,
		IsInGroup: () => true,
		IsPartyLFG: () => true,
		LE_PARTY_CATEGORY_INSTANCE: 2,
		Enum: {
			AddOnRestrictionType: {
				Combat: 0,
				Encounter: 1,
				ChallengeMode: 2,
				PvPMatch: 3,
				Map: 4,
				Chat: 5,
			},
		},
		C_RestrictedActions: { GetAddOnRestrictionState: () => 0 },
		GetZoneText: () => "The Ringing Deeps",
		GetSubZoneText: () => "The Dread Pit",
		GetRealZoneText: () => "The Dread Pit",
		C_Map: {
			GetBestMapForUnit: () => 2347,
			GetPlayerMapPosition: () => ({ x: 0.25, y: 0.75 }),
		},
		UnitFullName: () => ["Deckmage", "Aman'Thul"],
		UnitName: (unit: string) => [
			unit === "npc" ? "Quest Giver" : "Target",
			"Aman'Thul",
		],
		UnitGUID: (unit: string) => `${unit}-GUID`,
		GetRealmName: () => "Aman'Thul",
		UnitRace: () => ["Human", "Human", 1],
		UnitSex: () => 3,
		UnitPosition: () => [100, 200, 30, 2664],
		UnitClass: () => ["Mage", "MAGE", 8],
		UnitLevel: () => 90,
		C_SpecializationInfo: {
			GetSpecialization: () => 2,
			GetSpecializationInfo: () => [63, "Fire", "description", 1, "DAMAGER"],
		},
		InCombatLockdown: () => true,
		IsResting: () => false,
		UnitIsDeadOrGhost: () => false,
		IsMounted: () => false,
		IsFlying: () => false,
		GetBuildInfo: () => ["12.0.1", "12345", "today", 120001],
		GetLocale: () => "enUS",
		GetFramerate: () => 60,
		GetNetStats: () => [1, 2, 40, 50],
	});
	const result = new ErrorContextClient().capture();
	expect(result.buildCommit).toBeTypeOf("string");
	expect(result.details).toMatchObject({
		instanceName: "The Dread Pit",
		instanceType: "scenario",
		difficultyID: 208,
		instanceID: 2664,
		instanceGroupSize: 3,
		delveInProgress: true,
		delveTier: 8,
		groupSize: 3,
		inRaid: false,
		inInstance: true,
		zone: "The Ringing Deeps",
		subZone: "The Dread Pit",
		mapID: 2347,
		playerName: "Deckmage",
		playerRealm: "Aman'Thul",
		playerGUID: "player-GUID",
		realmName: "Aman'Thul",
		raceName: "Human",
		playerRace: "Human",
		raceID: 1,
		playerSex: 3,
		positionX: 100,
		positionY: 200,
		positionZ: 30,
		positionMapID: 2664,
		mapPositionX: 0.25,
		mapPositionY: 0.75,
		targetName: "Target",
		npcName: "Quest Giver",
		npcGUID: "npc-GUID",
		playerClass: "MAGE",
		classID: 8,
		level: 90,
		specializationID: 63,
		specializationName: "Fire",
		role: "DAMAGER",
		combatLockdown: true,
		gameVersion: "12.0.1",
		interfaceVersion: 120001,
		latencyWorld: 50,
	});
	expect(result.unavailableFields).toEqual([]);
});

it("redacts secret identity and position values before inspection and preserves safe fields", () => {
	const secret = new Proxy(
		{},
		{
			get: () => {
				throw Error("secret inspected");
			},
		},
	);
	vi.stubGlobal("issecretvalue", (value: unknown) => value === secret);
	vi.stubGlobal("_G", {
		UnitFullName: () => [secret, "Realm"],
		UnitRace: () => [secret, "Human", 1],
		UnitPosition: () => [secret, 200, 30, 2664],
		C_Map: {
			GetBestMapForUnit: () => 2347,
			GetPlayerMapPosition: () => secret,
		},
	});
	const result = new ErrorContextClient().capture();
	expect(result.details).toMatchObject({
		playerRealm: "Realm",
		playerRace: "Human",
		raceID: 1,
		positionY: 200,
		positionZ: 30,
	});
	expect(result.unavailableFields).toEqual(
		expect.arrayContaining([
			"playerName",
			"raceName",
			"positionX",
			"mapPositionX",
			"mapPositionY",
		]),
	);
	expect(() => JSON.stringify(result)).not.toThrow();
});

it("omits secret and failing API fields without losing the remaining context or inspecting secret values", () => {
	const secret = {
		toString: () => {
			throw new Error("must not stringify");
		},
	};
	vi.stubGlobal("issecretvalue", (value: unknown) => value === secret);
	vi.stubGlobal("_G", {
		GetZoneText: () => secret,
		GetSubZoneText: () => {
			throw new Error("unavailable");
		},
		GetNumGroupMembers: () => 0,
		UnitLevel: () => 90,
	});
	const result = new ErrorContextClient().capture();
	expect(result.details).toMatchObject({ groupSize: 1, level: 90 });
	expect(result.details.zone).toBeUndefined();
	expect(result.unavailableFields).toContain("zone");
	expect(result.unavailableFields).toContain("subZone");
	expect(() => JSON.stringify(result)).not.toThrow();
});
