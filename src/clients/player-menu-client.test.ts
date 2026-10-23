import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { PlayerMenuClient } from "./player-menu-client";

afterEach(() => vi.unstubAllGlobals());
function setup() {
	const game = { IsVisible: vi.fn(() => false) };
	const globals = {
		GameMenuFrame: game,
		GetPVPDesired: vi.fn(() => false),
		GetPVPTimer: () => 0,
		IsPVPTimerRunning: vi.fn(() => false),
		C_PvP: { SetPVP: vi.fn() },
		UnitPopupSharedUtil: {
			IsInWarModeState: vi.fn(() => false),
			HasLFGRestrictions: vi.fn(() => false),
		},
		C_SpecializationInfo: {
			GetSpecialization: () => 1,
			GetSpecializationInfo: vi.fn((index: number) => [
				index <= 3 ? 60 + index : undefined,
				["Arms", "Fury", "Protection"].at(index - 1),
			]),
		},
		HasLootSpecializations: () => true,
		UnitSex: () => 2,
		GetLootSpecialization: vi.fn(() => 0),
		SetLootSpecialization: vi.fn(),
		GetDungeonDifficultyID: () => 1,
		SetDungeonDifficultyID: vi.fn(),
		GetRaidDifficultyID: vi.fn(() => 14),
		GetLegacyRaidDifficultyID: () => 5,
		SetRaidDifficulties: vi.fn(),
		NormalizeLegacyDifficultyID: (id: number) => (id > 4 ? id - 2 : id),
		DifficultyUtil: {
			InStoryRaid: () => false,
			IsDungeonDifficultyEnabled: vi.fn(() => true),
			IsRaidDifficultyEnabled: vi.fn(() => true),
			DoesCurrentRaidDifficultyMatch: (id: number) => id === 14,
		},
		IsInInstance: vi.fn(() => [false, "none"]),
		IsInGroup: vi.fn((_category?: number) => false),
		UnitIsGroupLeader: vi.fn(() => false),
		GetInstanceInfo: () => ["", "none", 0, "", 0, false, false],
		CanChangePlayerDifficulty: () => false,
		GetDifficultyInfo: () => [],
		LE_PARTY_CATEGORY_INSTANCE: 2,
		StaticPopup_Show: vi.fn(),
		UnitPopup_OpenMenu: vi.fn(),
		Menu: { ModifyMenu: vi.fn() },
		IsInRaid: vi.fn(() => false),
		GetNumGroupMembers: vi.fn(() => 3),
		MEMBERS_PER_RAID_GROUP: 5,
		C_PartyInfo: {
			ConvertToRaid: vi.fn(),
			ConvertToParty: vi.fn(),
			LeaveParty: vi.fn(),
			IsPartyWalkIn: vi.fn(() => false),
			ChallengeModeRestrictionsActive: vi.fn(() => false),
			CanStartInstanceAbandonVote: vi.fn(() => false),
			StartInstanceAbandonVote: vi.fn(),
			IsCrossFactionParty: vi.fn(() => false),
		},
		PartyUtil: { CanLeaveInstance: vi.fn(() => false) },
		ConfirmOrLeaveParty: vi.fn(),
		C_ChallengeMode: {
			IsChallengeModeResettable: vi.fn(() => false),
			GetActiveKeystoneInfo: vi.fn(() => [0, 0, false]),
		},
		CanShowSetRoleButton: vi.fn(() => false),
		C_Scenario: { IsInScenario: vi.fn(() => false) },
		OverrideLFGSetRoleRestriction: vi.fn(() => false),
		UnitInPartyIsAI: vi.fn(() => false),
		AreClassRolesSoftSuggestions: vi.fn(() => false),
		UnitGroupRolesAssignedEnum: vi.fn(() => 1),
		UnitSetRoleEnum: vi.fn(),
		UnitGetAvailableRoles: vi.fn(() => [true, false, true]),
		Enum: { LFGRole: { Tank: 1, Healer: 2, Damage: 3 } },
		C_Garrison: {
			IsVisitGarrisonAvailable: vi.fn(() => false),
			IsUsingPartyGarrison: vi.fn(() => false),
			SetUsingPartyGarrison: vi.fn(),
		},
	};
	vi.stubGlobal("_G", globals);
	let changed = () => {};
	const controls = {
		watch: vi.fn((_frame, callback) => {
			changed = callback;
		}),
		release: vi.fn(),
	};
	let pending = () => {};
	const scheduler = {
		nextFrame: vi.fn((callback) => {
			pending = callback;
			return vi.fn();
		}),
		release: vi.fn(),
		destroy: () => true,
		prepareAction: vi.fn(),
	};
	const presentation = {
		render: vi.fn(),
		hide: vi.fn(),
		destroy: vi.fn(),
		grid: vi.fn(() => [
			[{ navId: "settings", onFocus() {}, onBlur() {}, onInteract() {} }],
		]),
	};
	const events = createTestEventBus();
	const client = new PlayerMenuClient(
		events,
		controls,
		scheduler,
		presentation,
	);
	client.initialize();
	const sections = () => client.getSections();
	const option = (id: string) => {
		const found = sections()
			.flatMap((section) => section.options)
			.find((entry) => entry.id === id);
		if (!found) throw new Error(`Missing setting ${id}`);
		return found;
	};
	const show = () => {
		game.IsVisible.mockReturnValue(true);
		changed();
		pending();
	};
	return {
		client,
		globals,
		presentation,
		scheduler,
		events,
		show,
		changed: () => changed(),
		flush: () => pending(),
		sections,
		option,
	};
}

it("shows only custom settings beside Escape, defers visibility refresh, and joins left/right navigation", () => {
	const s = setup();
	s.globals.GameMenuFrame.IsVisible.mockReturnValue(true);
	s.changed();
	expect(s.presentation.render).not.toHaveBeenCalled();
	s.flush();
	expect(s.sections().map((section) => section.id)).toEqual([
		"pvp",
		"loot",
		"dungeon",
		"raid",
		"legacy",
		"reset",
	]);
	expect(s.globals.UnitPopup_OpenMenu).not.toHaveBeenCalled();
	const game = { navId: "escape", onFocus() {}, onBlur() {}, onInteract() {} };
	expect(
		s.client
			.decorateGameMenu([[game]])
			.at(0)
			?.map((node) => [node.navId, node.navColumn]),
	).toEqual([
		["settings", 0],
		["escape", 1],
	]);
	s.globals.GameMenuFrame.IsVisible.mockReturnValue(false);
	s.changed();
	s.flush();
	expect(s.presentation.hide).toHaveBeenCalled();
	expect(s.client.decorateGameMenu([[game]])).toEqual([[game]]);
	s.client.shutdown();
	expect(s.presentation.destroy).toHaveBeenCalledOnce();
});

it("separates PvP checkbox and class loot radios, routes validated choices and confirms reset", () => {
	const s = setup();
	s.show();
	expect(
		s
			.sections()
			.find((section) => section.id === "loot")
			?.options.map((option) => [option.value, option.checked]),
	).toEqual([
		[0, true],
		[61, false],
		[62, false],
		[63, false],
	]);
	expect(s.option("pvp").kind).toBe("checkbox");
	s.option("pvp").activate();
	expect(s.globals.C_PvP.SetPVP).toHaveBeenCalledWith(1);
	s.option("loot:62").activate();
	expect(s.globals.SetLootSpecialization).toHaveBeenCalledWith(62);
	s.option("dungeon:23").activate();
	expect(s.globals.SetDungeonDifficultyID).toHaveBeenCalledWith(23);
	s.option("raid:15").activate();
	expect(s.globals.SetRaidDifficulties).toHaveBeenCalledWith(true, 15);
	expect(s.option("legacy:3").checked).toBe(true);
	s.option("legacy:4").activate();
	expect(s.globals.SetRaidDifficulties).toHaveBeenCalledWith(false, 4);
	s.option("reset").activate();
	expect(s.globals.StaticPopup_Show).toHaveBeenCalledWith(
		"CONFIRM_RESET_INSTANCES",
	);
});

it("rechecks permissions at activation, shows War Mode context, and refreshes from the injected bus", () => {
	const s = setup();
	s.show();
	const stale = s.option("dungeon:2");
	s.globals.DifficultyUtil.IsDungeonDifficultyEnabled.mockReturnValue(false);
	stale.activate();
	expect(s.globals.SetDungeonDifficultyID).not.toHaveBeenCalled();
	s.globals.UnitPopupSharedUtil.IsInWarModeState.mockReturnValue(true);
	s.globals.GetRaidDifficultyID.mockReturnValue(16);
	s.globals.UnitIsGroupLeader.mockReturnValue(false);
	s.globals.IsInGroup.mockReturnValue(true);
	s.events.emit("PLAYER_SETTINGS_CHANGED");
	s.flush();
	expect(s.option("pvp").enabled).toBe(false);
	expect(s.sections().at(0)?.note).toContain("War Mode");
	expect(s.option("legacy:3").enabled).toBe(false);
	expect(s.option("reset").enabled).toBe(false);
	s.option("reset").activate();
	expect(s.globals.StaticPopup_Show).not.toHaveBeenCalled();
	s.client.shutdown();
	s.events.emit("PLAYER_SETTINGS_CHANGED");
	s.flush();
	expect(s.presentation.destroy).toHaveBeenCalledOnce();
});

it("offers all valid class specs and reflects PvP disable countdown without pretending War Mode changed", () => {
	const s = setup();
	s.globals.C_SpecializationInfo.GetSpecializationInfo.mockImplementation(
		(index) => [60 + index, `Spec ${index}`],
	);
	s.globals.GetPVPDesired.mockReturnValue(true);
	s.show();
	expect(
		s.sections().find((section) => section.id === "loot")?.options,
	).toHaveLength(5);
	s.option("pvp").activate();
	expect(s.globals.C_PvP.SetPVP).toHaveBeenCalledWith(undefined);
	s.globals.GetPVPDesired.mockReturnValue(false);
	s.globals.GetPVPTimer = () => 300000;
	s.globals.IsPVPTimerRunning.mockReturnValue(true);
	expect(s.sections().at(0)?.note).toContain("counting down");
});

it("does not report a countdown from a positive timer value when the PvP timer is not running", () => {
	const s = setup();
	s.globals.GetPVPTimer = () => 4294967295;
	s.show();
	expect(s.sections().at(0)?.note).toBeUndefined();
	s.globals.IsPVPTimerRunning.mockReturnValue(true);
	expect(s.sections().at(0)?.note).toContain("counting down");
	s.globals.IsPVPTimerRunning.mockReturnValue(false);
	expect(s.sections().at(0)?.note).toBeUndefined();
});

it("shows contextual conversion, leave and challenge reset actions with Blizzard permissions and confirmation paths", () => {
	const s = setup();
	s.show();
	expect(
		s
			.sections()
			.flatMap((section) => section.options)
			.some((option) => option.id === "convert"),
	).toBe(false);
	s.globals.IsInGroup.mockImplementation((category) => category === undefined);
	s.globals.UnitIsGroupLeader.mockReturnValue(true);
	s.option("convert").activate();
	expect(s.globals.C_PartyInfo.ConvertToRaid).toHaveBeenCalledOnce();
	s.option("leave-group").activate();
	expect(s.globals.C_PartyInfo.LeaveParty).toHaveBeenCalledOnce();
	s.globals.IsInRaid.mockReturnValue(true);
	s.globals.GetNumGroupMembers.mockReturnValue(6);
	expect(s.option("convert").enabled).toBe(false);
	s.option("convert").activate();
	expect(s.globals.C_PartyInfo.ConvertToParty).not.toHaveBeenCalled();
	s.globals.GetNumGroupMembers.mockReturnValue(5);
	s.option("convert").activate();
	expect(s.globals.C_PartyInfo.ConvertToParty).toHaveBeenCalledOnce();
	s.globals.PartyUtil.CanLeaveInstance.mockReturnValue(true);
	s.option("leave-instance").activate();
	expect(s.globals.ConfirmOrLeaveParty).toHaveBeenCalledOnce();
	s.globals.IsInInstance.mockReturnValue([true, "party"]);
	s.globals.C_ChallengeMode.IsChallengeModeResettable.mockReturnValue(true);
	s.option("reset-challenge").activate();
	expect(s.globals.StaticPopup_Show).toHaveBeenCalledWith(
		"CONFIRM_RESET_CHALLENGE_MODE",
	);
	s.globals.C_ChallengeMode.GetActiveKeystoneInfo.mockReturnValue([0, 0, true]);
	expect(s.option("reset-challenge").enabled).toBe(false);
	s.globals.UnitIsGroupLeader.mockReturnValue(false);
	expect(
		s
			.sections()
			.flatMap((section) => section.options)
			.some(
				(option) => option.id === "reset-challenge" || option.id === "convert",
			),
	).toBe(false);
});

it("offers Vote to Abandon only in challenge context and rechecks vote availability", () => {
	const s = setup();
	s.show();
	expect(
		s
			.sections()
			.flatMap((section) => section.options)
			.some((option) => option.id === "abandon"),
	).toBe(false);
	s.globals.C_PartyInfo.ChallengeModeRestrictionsActive.mockReturnValue(true);
	expect(s.option("abandon").enabled).toBe(false);
	s.globals.C_PartyInfo.CanStartInstanceAbandonVote.mockReturnValue(true);
	const option = s.option("abandon");
	option.activate();
	expect(s.globals.C_PartyInfo.StartInstanceAbandonVote).toHaveBeenCalledOnce();
	s.globals.C_PartyInfo.CanStartInstanceAbandonVote.mockReturnValue(false);
	option.activate();
	expect(s.globals.C_PartyInfo.StartInstanceAbandonVote).toHaveBeenCalledOnce();
});

it("offers self role choices with class restrictions and LFG override, and contextual garrison visit/return", () => {
	const s = setup();
	s.show();
	s.globals.IsInGroup.mockReturnValue(true);
	s.globals.CanShowSetRoleButton.mockReturnValue(true);
	expect(
		s
			.sections()
			.find((section) => section.id === "role")
			?.options.map((option) => [option.label, option.enabled, option.checked]),
	).toEqual([
		["Tank", true, true],
		["Healer", false, false],
		["Damage", true, false],
		["None", true, false],
	]);
	s.option("role:3").activate();
	expect(s.globals.UnitSetRoleEnum).toHaveBeenCalledWith("player", 3);
	s.option("role:none").activate();
	expect(s.globals.UnitSetRoleEnum).toHaveBeenCalledWith("player", undefined);
	s.globals.UnitPopupSharedUtil.HasLFGRestrictions.mockReturnValue(true);
	expect(s.sections().some((section) => section.id === "role")).toBe(false);
	s.globals.OverrideLFGSetRoleRestriction.mockReturnValue(true);
	expect(s.sections().some((section) => section.id === "role")).toBe(true);
	s.globals.C_Scenario.IsInScenario.mockReturnValue(true);
	expect(s.sections().some((section) => section.id === "role")).toBe(false);
	s.globals.C_Garrison.IsVisitGarrisonAvailable.mockReturnValue(true);
	s.option("garrison").activate();
	expect(s.globals.C_Garrison.SetUsingPartyGarrison).toHaveBeenCalledWith(true);
	s.globals.C_Garrison.IsUsingPartyGarrison.mockReturnValue(true);
	expect(s.option("garrison").label).toBe("Return to Your Garrison");
	s.option("garrison").activate();
	expect(s.globals.C_Garrison.SetUsingPartyGarrison).toHaveBeenCalledWith(
		false,
	);
	s.globals.C_PartyInfo.IsCrossFactionParty.mockReturnValue(true);
	expect(
		s
			.sections()
			.flatMap((section) => section.options)
			.some((option) => option.id === "garrison"),
	).toBe(false);
});
