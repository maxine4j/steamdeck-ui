export interface TalentSpec {
	readonly id: number;
	readonly index: number;
	readonly name: string;
	readonly icon?: number;
	readonly role: string;
	readonly selected: boolean;
}
export interface TalentLoadout {
	readonly id: number;
	readonly name: string;
	readonly selected: boolean;
}
export interface TalentSummary {
	readonly specs: TalentSpec[];
	readonly specID?: number;
	readonly loadouts: TalentLoadout[];
	readonly starterAvailable: boolean;
	readonly starterSelected: boolean;
}
export interface ITalentsClient {
	read(): TalentSummary;
	selectSpec(id: number): string | undefined;
	selectLoadout(specID: number, id: number): string | undefined;
	selectStarter(specID: number): string | undefined;
}
// The declaration generator flattens documented table returns; keep corrections at the client seam.
const configIDs = (specID: number): number[] =>
	(
		C_ClassTalents.GetConfigIDsBySpecID as unknown as (
			this: void,
			specID: number,
		) => number[]
	)(specID);
const configInfo = (id: number) =>
	(
		C_Traits.GetConfigInfo as unknown as (
			this: void,
			id: number,
		) => { name: string } | undefined
	)(id);

export class TalentsClient implements ITalentsClient {
	private specs(): TalentSpec[] {
		const [, , classID] = (
			UnitClass as unknown as (
				this: void,
				unit: string,
			) => LuaMultiReturn<[string, string, number]>
		)("player");
		const current = C_SpecializationInfo.GetSpecialization();
		const specs: TalentSpec[] = [];
		if (!classID) return specs;
		const count = C_SpecializationInfo.GetNumSpecializationsForClassID(classID);
		for (let index = 1; index <= count; index++) {
			const [id, name, , icon, role] =
				C_SpecializationInfo.GetSpecializationInfo(index, false, false);
			if (id && name)
				specs.push({
					id,
					index,
					name,
					icon: icon ?? undefined,
					role: role ?? "",
					selected: index === current,
				});
		}
		return specs;
	}
	read(): TalentSummary {
		const specs = this.specs();
		const specID = specs.find((spec) => spec.selected)?.id;
		const starterSelected =
			specID !== undefined && C_ClassTalents.GetStarterBuildActive();
		const selected =
			specID === undefined
				? undefined
				: C_ClassTalents.GetLastSelectedSavedConfigID(specID);
		const loadouts: TalentLoadout[] = [];
		if (specID !== undefined)
			for (const id of configIDs(specID)) {
				const info = configInfo(id);
				if (info)
					loadouts.push({
						id,
						name: info.name,
						selected: !starterSelected && selected === id,
					});
			}
		return {
			specs,
			specID,
			loadouts,
			starterAvailable:
				specID !== undefined && C_ClassTalents.GetHasStarterBuild(),
			starterSelected,
		};
	}
	private restriction(): string | undefined {
		if (InCombatLockdown()) return "Cannot switch talents in combat.";
		const [available] = C_SpecializationInfo.CanPlayerUseTalentSpecUI();
		if (!available) return "Specializations are not available yet.";
		return undefined;
	}
	selectSpec(id: number): string | undefined {
		const error = this.restriction();
		if (error) return error;
		const spec = this.specs().find((candidate) => candidate.id === id);
		if (!spec) return "Specialization is no longer available.";
		if (!spec.selected)
			C_ClassTalents.SwitchToSpecializationByIndex(spec.index);
		return undefined;
	}
	private loadoutRestriction(specID: number): string | undefined {
		const error = this.restriction();
		if (error) return error;
		if (this.specs().find((spec) => spec.selected)?.id !== specID)
			return "Specialization changed. Select the loadout again.";
		const [canEdit, reason] = C_ClassTalents.CanEditTalents();
		return canEdit ? undefined : reason || "Cannot change talents here.";
	}
	private prepareLoadouts(): string | undefined {
		if (!PlayerSpellsFrame) PlayerSpellsFrame_LoadUI();
		if (!PlayerSpellsFrame) return "Blizzard talents could not be loaded.";
		if (PlayerSpellsFrame.IsInspecting())
			return "Close talent inspection before changing loadouts.";
		// The hidden native dropdown does not receive config-list events. Refresh its small ID list before using its index helper.
		PlayerSpellsFrame.TalentsFrame.RefreshLoadoutOptions();
		return undefined;
	}
	selectLoadout(specID: number, id: number): string | undefined {
		const error = this.loadoutRestriction(specID);
		if (error) return error;
		const index = configIDs(specID).indexOf(id);
		if (index < 0 || !configInfo(id)) return "Loadout is no longer available.";
		const prepareError = this.prepareLoadouts();
		if (prepareError) return prepareError;
		// Blizzard's helper owns async commits, saved selection, and per-loadout action bars.
		C_ClassTalents.SwitchToLoadoutByIndex(index + 1);
		return undefined;
	}
	selectStarter(specID: number): string | undefined {
		const error = this.loadoutRestriction(specID);
		if (error) return error;
		if (!C_ClassTalents.GetHasStarterBuild())
			return "Starter build is not available.";
		const prepareError = this.prepareLoadouts();
		if (prepareError) return prepareError;
		// Blizzard appends the starter build after the saved configs in its dropdown.
		C_ClassTalents.SwitchToLoadoutByIndex(configIDs(specID).length + 1);
		return undefined;
	}
}
