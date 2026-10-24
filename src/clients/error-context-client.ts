import { BUILD_COMMIT } from "../build-info";

export interface ErrorEnvironment {
	readonly buildCommit: string;
	readonly details: Readonly<Record<string, string | number | boolean>>;
	readonly unavailableFields: readonly string[];
}

/** Retail globals; unit-token declarations in the generated API use numbers. */
interface ContextGlobals {
	GetInstanceInfo(
		this: void,
	): LuaMultiReturn<
		[
			string,
			string,
			number,
			string,
			number,
			number,
			boolean | null,
			number,
			number,
		]
	>;
	IsInInstance(this: void): LuaMultiReturn<[boolean, string]>;
	C_PartyInfo: { IsDelveInProgress(this: void): boolean };
	C_DelvesUI: { GetActiveDelveTier(this: void): number };
	GetNumGroupMembers(this: void): number;
	IsInRaid(this: void): boolean;
	IsInGroup(this: void, category?: number): boolean;
	IsPartyLFG(this: void): boolean;
	LE_PARTY_CATEGORY_INSTANCE: number;
	Enum: { AddOnRestrictionType: Record<string, number> };
	C_RestrictedActions: {
		GetAddOnRestrictionState(this: void, type: number): number;
	};
	GetZoneText(this: void): string;
	GetSubZoneText(this: void): string;
	GetRealZoneText(this: void): string;
	C_Map: { GetBestMapForUnit(this: void, unit: string): number | undefined };
	UnitClass(this: void, unit: string): LuaMultiReturn<[string, string, number]>;
	UnitLevel(this: void, unit: string): number;
	C_SpecializationInfo: {
		GetSpecialization(this: void): number | undefined;
		GetSpecializationInfo(
			this: void,
			index: number,
			inspect: boolean,
			pet: boolean,
		): LuaMultiReturn<
			[
				number,
				string | undefined,
				string | undefined,
				number | undefined,
				string | undefined,
			]
		>;
	};
	InCombatLockdown(this: void): boolean;
	IsResting(this: void): boolean;
	UnitIsDeadOrGhost(this: void, unit: string): boolean;
	IsMounted(this: void): boolean;
	IsFlying(this: void): boolean;
	GetBuildInfo(this: void): LuaMultiReturn<[string, string, string, number]>;
	GetLocale(this: void): string;
	GetFramerate(this: void): number;
	GetNetStats(this: void): LuaMultiReturn<[number, number, number, number]>;
}

/** Only primitive, non-secret metadata; no scans or UI access in the error path. */
export class ErrorContextClient {
	capture(): ErrorEnvironment {
		const g = _G as unknown as ContextGlobals;
		const details: Record<string, string | number | boolean> = {};
		const unavailableFields: string[] = [];
		const secret = issecretvalue as unknown as (
			this: void,
			value: unknown,
		) => boolean;
		const collect = (
			fields: readonly string[],
			read: () => readonly unknown[],
		) => {
			try {
				const values = read();
				for (let i = 0; i < fields.length; i++) {
					const field = fields.at(i);
					if (field === undefined) continue;
					const value = values.at(i);
					if (secret(value)) unavailableFields.push(field);
					else if (typeof value === "string")
						details[field] = value.slice(0, 500);
					else if (typeof value === "boolean" || typeof value === "number")
						details[field] = value;
					else unavailableFields.push(field);
				}
			} catch {
				for (const field of fields) unavailableFields.push(field);
			}
		};
		collect(
			[
				"instanceName",
				"instanceType",
				"difficultyID",
				"difficultyName",
				"maxPlayers",
				"instanceID",
				"instanceGroupSize",
			],
			() => {
				const [
					name,
					type,
					difficulty,
					difficultyName,
					maxPlayers,
					,
					,
					id,
					size,
				] = g.GetInstanceInfo();
				return [name, type, difficulty, difficultyName, maxPlayers, id, size];
			},
		);
		collect(["inInstance"], () => {
			const [inside] = g.IsInInstance();
			return [inside];
		});
		collect(["delveInProgress"], () => [g.C_PartyInfo.IsDelveInProgress()]);
		collect(["delveTier"], () => [g.C_DelvesUI.GetActiveDelveTier()]);
		collect(["groupSize"], () => [g.GetNumGroupMembers()]);
		if (typeof details.groupSize === "number")
			details.groupSize = Math.max(1, details.groupSize);
		collect(["inRaid"], () => [g.IsInRaid()]);
		collect(["inGroup"], () => [g.IsInGroup()]);
		collect(["inLFGGroup"], () => [g.IsPartyLFG()]);
		collect(["instanceParty"], () => [
			g.IsInGroup(g.LE_PARTY_CATEGORY_INSTANCE),
		]);
		for (const restriction of [
			"Combat",
			"Encounter",
			"ChallengeMode",
			"PvPMatch",
			"Map",
			"Chat",
		])
			collect([`restriction${restriction}`], () => [
				g.C_RestrictedActions.GetAddOnRestrictionState(
					g.Enum.AddOnRestrictionType[restriction],
				),
			]);
		collect(["zone"], () => [g.GetZoneText()]);
		collect(["subZone"], () => [g.GetSubZoneText()]);
		collect(["realZone"], () => [g.GetRealZoneText()]);
		collect(["mapID"], () => [g.C_Map.GetBestMapForUnit("player")]);
		collect(["className", "playerClass", "classID"], () => {
			const [name, token, id] = g.UnitClass("player");
			return [name, token, id];
		});
		collect(["level"], () => [g.UnitLevel("player")]);
		collect(["specializationID", "specializationName", "role"], () => {
			const index = g.C_SpecializationInfo.GetSpecialization();
			if (secret(index) || !index) return [];
			const [id, name, , , role] = g.C_SpecializationInfo.GetSpecializationInfo(
				index,
				false,
				false,
			);
			return [id, name, role];
		});
		collect(["combatLockdown"], () => [g.InCombatLockdown()]);
		collect(["resting"], () => [g.IsResting()]);
		collect(["deadOrGhost"], () => [g.UnitIsDeadOrGhost("player")]);
		collect(["mounted"], () => [g.IsMounted()]);
		collect(["flying"], () => [g.IsFlying()]);
		collect(
			["gameVersion", "gameBuild", "buildDate", "interfaceVersion"],
			() => {
				const [version, build, date, toc] = g.GetBuildInfo();
				return [version, build, date, toc];
			},
		);
		collect(["locale"], () => [g.GetLocale()]);
		collect(["framerate"], () => [g.GetFramerate()]);
		collect(["latencyHome", "latencyWorld"], () => {
			const [, , home, world] = g.GetNetStats();
			return [home, world];
		});
		return { buildCommit: BUILD_COMMIT, details, unavailableFields };
	}
}
