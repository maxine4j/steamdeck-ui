import { afterEach, expect, it, vi } from "vitest";
import { TalentsClient } from "./talents-client";

afterEach(() => vi.unstubAllGlobals());
function setup(count = 4) {
	vi.stubGlobal("PlayerSpellsFrame", {
		IsInspecting: () => false,
		TalentsFrame: { RefreshLoadoutOptions: vi.fn() },
	});
	vi.stubGlobal("UnitClass", () => ["Druid", "DRUID", 11]);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("C_SpecializationInfo", {
		GetNumSpecializationsForClassID: () => count,
		GetSpecialization: () => 2,
		GetSpecializationInfo: (index: number) => [
			100 + index,
			`Spec ${index}`,
			"Description",
			10,
			"DAMAGER",
		],
		CanPlayerUseTalentSpecUI: () => [true],
	});
	const api = {
		GetConfigIDsBySpecID: vi.fn(() => [40, 41]),
		GetLastSelectedSavedConfigID: () => 41,
		GetStarterBuildActive: () => false,
		GetHasStarterBuild: () => true,
		CanEditTalents: () => [true, ""],
		SwitchToLoadoutByIndex: vi.fn(),
		SwitchToSpecializationByIndex: vi.fn(),
	};
	vi.stubGlobal("C_ClassTalents", api);
	vi.stubGlobal("C_Traits", {
		GetConfigInfo: (id: number) => ({ name: `Loadout ${id}` }),
	});
	return { client: new TalentsClient(), api };
}
it.each([2, 3, 4])(
	"reads all %i specs and only the current spec's saved loadouts",
	(count) => {
		const { client, api } = setup(count);
		const data = client.read();
		expect(data.specs).toHaveLength(count);
		expect(data.specs.at(1)).toMatchObject({
			id: 102,
			index: 2,
			selected: true,
		});
		expect(api.GetConfigIDsBySpecID).toHaveBeenCalledWith(102);
		expect(data.loadouts).toEqual([
			{ id: 40, name: "Loadout 40", selected: false },
			{ id: 41, name: "Loadout 41", selected: true },
		]);
		expect(data.starterAvailable).toBe(true);
	},
);
it("resolves a saved ID at activation time and delegates commit handling to Blizzard", () => {
	const { client, api } = setup();
	api.GetConfigIDsBySpecID.mockReturnValue([41, 40]);
	client.selectLoadout(102, 40);
	expect(api.SwitchToLoadoutByIndex).toHaveBeenCalledExactlyOnceWith(2);
	client.selectStarter(102);
	expect(api.SwitchToLoadoutByIndex).toHaveBeenLastCalledWith(3);
	client.selectSpec(104);
	expect(api.SwitchToSpecializationByIndex).toHaveBeenCalledExactlyOnceWith(4);
});
it("rejects combat, restricted edits, stale specs and deleted loadouts", () => {
	const { client, api } = setup();
	client.selectLoadout(101, 40);
	client.selectLoadout(102, 999);
	expect(api.SwitchToLoadoutByIndex).not.toHaveBeenCalled();
	vi.stubGlobal("InCombatLockdown", () => true);
	expect(client.selectSpec(104)).toContain("combat");
	expect(client.selectLoadout(102, 40)).toContain("combat");
	expect(api.SwitchToSpecializationByIndex).not.toHaveBeenCalled();
	vi.stubGlobal("InCombatLockdown", () => false);
	api.CanEditTalents = () => [false, "Unavailable here"];
	expect(client.selectLoadout(102, 40)).toBe("Unavailable here");
	expect(api.SwitchToLoadoutByIndex).not.toHaveBeenCalled();
});

it("handles characters without an active spec and starter selection", () => {
	const { client, api } = setup(0);
	expect(client.read()).toMatchObject({
		specs: [],
		loadouts: [],
		starterAvailable: false,
	});
	expect(api.GetConfigIDsBySpecID).not.toHaveBeenCalled();
	setup();
	api.GetStarterBuildActive = () => true;
	vi.stubGlobal("C_ClassTalents", api);
	expect(client.read().loadouts.every((loadout) => !loadout.selected)).toBe(
		true,
	);
	expect(client.read().starterSelected).toBe(true);
});

it("refreshes the hidden native dropdown before switching and refuses inspection", () => {
	const { client, api } = setup();
	const refresh = vi.fn();
	vi.stubGlobal("PlayerSpellsFrame", {
		IsInspecting: () => false,
		TalentsFrame: { RefreshLoadoutOptions: refresh },
	});
	client.selectLoadout(102, 40);
	expect(refresh).toHaveBeenCalledOnce();
	expect(refresh.mock.invocationCallOrder.at(0)).toBeLessThan(
		api.SwitchToLoadoutByIndex.mock.invocationCallOrder.at(0) ?? 0,
	);
	vi.stubGlobal("PlayerSpellsFrame", { IsInspecting: () => true });
	expect(client.selectLoadout(102, 40)).toContain("inspection");
	expect(api.SwitchToLoadoutByIndex).toHaveBeenCalledOnce();
});
