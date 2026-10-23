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
		GetZoneText: () => "The Ringing Deeps",
		GetSubZoneText: () => "The Dread Pit",
		GetRealZoneText: () => "The Dread Pit",
		C_Map: { GetBestMapForUnit: () => 2347 },
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
