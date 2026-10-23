import type { IEventBus } from "../events/types";
import type {
	IPlayerSettingsPresentation,
	PlayerSettingsOption,
	PlayerSettingsSection,
} from "../modules/system-dialogs/player-settings-presentation";
import type {
	NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import type { NavGrid } from "../ui/navigation/types";
import type {
	INativeDialogsClient,
	NativeDialog,
} from "./native-dialogs-client";
import type { ITaskScheduler } from "./task-scheduler";

/** Retail FrameXML APIs, including Lua multi-return signatures absent from generated declarations. */
interface PlayerSettingsGlobals {
	GameMenuFrame?: NativeDialogFrame;
	GetPVPDesired(this: void): boolean;
	GetPVPTimer(this: void): number;
	C_PvP: { SetPVP(this: void, enabled?: number): void };
	UnitPopupSharedUtil: {
		IsInWarModeState(this: void): boolean;
		HasLFGRestrictions(this: void): boolean;
	};
	C_SpecializationInfo: {
		GetSpecialization(this: void): number | undefined;
		GetSpecializationInfo(
			this: void,
			index: number,
			inspect: boolean,
			pet: boolean,
			target: undefined,
			sex: number,
		): LuaMultiReturn<[number | undefined, string | undefined]>;
	};
	HasLootSpecializations(this: void): boolean;
	UnitSex(this: void, unit: string): number;
	GetLootSpecialization(this: void): number;
	SetLootSpecialization(this: void, id: number): void;
	GetDungeonDifficultyID(this: void): number;
	SetDungeonDifficultyID(this: void, id: number): void;
	GetRaidDifficultyID(this: void): number;
	GetLegacyRaidDifficultyID(this: void): number;
	SetRaidDifficulties(this: void, primary: boolean, id: number): void;
	NormalizeLegacyDifficultyID(this: void, id: number): number;
	DifficultyUtil: {
		InStoryRaid(this: void): boolean;
		IsDungeonDifficultyEnabled(this: void, id: number): boolean;
		IsRaidDifficultyEnabled(this: void, id: number): boolean;
		DoesCurrentRaidDifficultyMatch(this: void, id: number): boolean;
	};
	IsInInstance(this: void): LuaMultiReturn<[boolean, string]>;
	IsInGroup(this: void, category?: number): boolean;
	UnitIsGroupLeader(this: void, unit: string): boolean;
	GetInstanceInfo(
		this: void,
	): LuaMultiReturn<[string, string, number, string, number, boolean, boolean]>;
	CanChangePlayerDifficulty(this: void): boolean;
	GetDifficultyInfo(
		this: void,
		id: number,
	): LuaMultiReturn<
		[string, string, boolean, boolean, boolean, boolean, number | undefined]
	>;
	LE_PARTY_CATEGORY_INSTANCE: number;
	StaticPopup_Show(this: void, name: string): void;
	IsInRaid(this: void): boolean;
	GetNumGroupMembers(this: void): number;
	MEMBERS_PER_RAID_GROUP: number;
	C_PartyInfo: {
		ConvertToRaid(this: void): void;
		ConvertToParty(this: void): void;
		LeaveParty(this: void): void;
		IsPartyWalkIn(this: void): boolean;
		ChallengeModeRestrictionsActive(this: void): boolean;
		CanStartInstanceAbandonVote(this: void): boolean;
		StartInstanceAbandonVote(this: void): void;
		IsCrossFactionParty(this: void): boolean;
	};
	PartyUtil: { CanLeaveInstance(this: void): boolean };
	ConfirmOrLeaveParty(this: void): void;
	C_ChallengeMode: {
		IsChallengeModeResettable(this: void): boolean;
		GetActiveKeystoneInfo?(
			this: void,
		): LuaMultiReturn<[number, number, boolean]>;
	};
	CanShowSetRoleButton(this: void): boolean;
	C_Scenario: { IsInScenario(this: void): boolean };
	OverrideLFGSetRoleRestriction(this: void): boolean;
	UnitInPartyIsAI(this: void, unit: string): boolean;
	AreClassRolesSoftSuggestions(this: void): boolean;
	UnitGroupRolesAssignedEnum(this: void, unit: string): number | undefined;
	UnitSetRoleEnum(this: void, unit: string, role?: number): void;
	UnitGetAvailableRoles(
		this: void,
		unit: string,
	): LuaMultiReturn<[boolean, boolean, boolean]>;
	Enum: { LFGRole: { Tank: number; Healer: number; Damage: number } };
	C_Garrison: {
		IsVisitGarrisonAvailable(this: void): boolean;
		IsUsingPartyGarrison(this: void): boolean;
		SetUsingPartyGarrison(this: void, using: boolean): void;
	};
}

/** Own controls only: never opens or touches Blizzard's pooled SELF context menu. */
export class PlayerMenuClient implements INativeDialogsClient {
	private active = false;
	private visible = false;
	private cancelPending?: () => void;
	private readonly changed = () => {
		if (
			this.active &&
			!(_G as unknown as PlayerSettingsGlobals).GameMenuFrame?.IsVisible()
		) {
			this.visible = false;
			this.presentation.hide();
		}
		if (!this.active || this.cancelPending) return;
		this.cancelPending = this.scheduler.nextFrame(() => {
			this.cancelPending = undefined;
			if (!this.active) return;
			this.refresh();
			this.events.emit("NATIVE_DIALOGS_CHANGED");
		});
	};
	constructor(
		private readonly events: IEventBus,
		private readonly controls: Pick<
			NativeDialogNavigation,
			"watch" | "release"
		>,
		private readonly scheduler: Pick<ITaskScheduler, "nextFrame">,
		private readonly presentation: IPlayerSettingsPresentation,
	) {}
	initialize(): void {
		this.active = true;
		this.events.subscribe("PLAYER_SETTINGS_CHANGED", this.changed);
		const owner = (_G as unknown as PlayerSettingsGlobals).GameMenuFrame;
		if (owner) this.controls.watch(owner, this.changed);
		this.changed();
	}
	private refresh(): void {
		const owner = (_G as unknown as PlayerSettingsGlobals).GameMenuFrame;
		this.visible = this.active && owner?.IsVisible() === true;
		if (this.visible && owner)
			this.presentation.render(owner, this.getSections());
		else this.presentation.hide();
	}
	getSections(): PlayerSettingsSection[] {
		const g = _G as unknown as PlayerSettingsGlobals;
		const makeOption = (
			id: string,
			label: string,
			kind: PlayerSettingsOption["kind"],
			checked: boolean,
			enabled: boolean,
			action: () => void,
			value?: number,
		): PlayerSettingsOption => ({
			id,
			label,
			kind,
			checked,
			enabled,
			value,
			activate: () => {
				if (!this.active || !this.visible || !g.GameMenuFrame?.IsVisible())
					return;
				// The group/instance may change while a controller node remains focused.
				if (
					!this.getSections()
						.flatMap((section) => section.options)
						.find((option) => option.id === id)?.enabled
				)
					return;
				action();
				this.changed();
			},
		});
		const warMode = g.UnitPopupSharedUtil.IsInWarModeState();
		const pvp = g.GetPVPDesired();
		const pvpSection: PlayerSettingsSection = {
			id: "pvp",
			title: "PvP",
			note: warMode
				? "Controlled by War Mode"
				: !pvp && g.GetPVPTimer() > 0
					? "PvP flag is counting down"
					: undefined,
			options: [
				makeOption(
					"pvp",
					pvp ? "PvP enabled" : "PvP disabled",
					"checkbox",
					pvp,
					!warMode,
					() => g.C_PvP.SetPVP(g.GetPVPDesired() ? undefined : 1),
				),
			],
		};
		const loot: PlayerSettingsOption[] = [];
		const spec = g.C_SpecializationInfo.GetSpecialization();
		if (g.HasLootSpecializations() && spec) {
			const [, currentName] = g.C_SpecializationInfo.GetSpecializationInfo(
				spec,
				false,
				false,
				undefined,
				g.UnitSex("player"),
			);
			const choice = (id: number, label: string) =>
				makeOption(
					`loot:${id}`,
					label,
					"radio",
					g.GetLootSpecialization() === id,
					true,
					() => g.SetLootSpecialization(id),
					id,
				);
			loot.push(choice(0, `Current (${currentName ?? "specialization"})`));
			for (let index = 1; index <= 4; index++) {
				const [id, name] = g.C_SpecializationInfo.GetSpecializationInfo(
					index,
					false,
					false,
					undefined,
					g.UnitSex("player"),
				);
				if (id && name) loot.push(choice(id, name));
			}
		}
		const dungeon = [1, 2, 23].map((id, index) =>
			makeOption(
				`dungeon:${id}`,
				["Normal", "Heroic", "Mythic"].at(index) ?? "",
				"radio",
				g.GetDungeonDifficultyID() === id,
				!g.DifficultyUtil.InStoryRaid() &&
					g.DifficultyUtil.IsDungeonDifficultyEnabled(id),
				() => g.SetDungeonDifficultyID(id),
				id,
			),
		);
		const raid = [14, 15, 16].map((id, index) =>
			makeOption(
				`raid:${id}`,
				["Normal", "Heroic", "Mythic"].at(index) ?? "",
				"radio",
				g.DifficultyUtil.DoesCurrentRaidDifficultyMatch(id),
				!g.DifficultyUtil.InStoryRaid() &&
					g.DifficultyUtil.IsRaidDifficultyEnabled(id),
				() => g.SetRaidDifficulties(true, id),
				id,
			),
		);
		const [inside, instanceType] = g.IsInInstance();
		const leader = !g.IsInGroup() || g.UnitIsGroupLeader("player");
		const [, , instanceDifficulty, , , , dynamic] = g.GetInstanceInfo();
		let legacyEnabled =
			!inside &&
			leader &&
			!g.IsInGroup(g.LE_PARTY_CATEGORY_INSTANCE) &&
			g.GetRaidDifficultyID() !== 16 &&
			!g.DifficultyUtil.InStoryRaid();
		if (dynamic && g.CanChangePlayerDifficulty()) {
			const [, , , , , , toggle] = g.GetDifficultyInfo(instanceDifficulty);
			if (toggle) legacyEnabled = false;
		}
		const legacyId = g.NormalizeLegacyDifficultyID(
			dynamic ? instanceDifficulty : g.GetLegacyRaidDifficultyID(),
		);
		const instanceActions = [
			makeOption(
				"reset",
				"Reset All Instances",
				"button",
				false,
				!inside && leader && !g.UnitPopupSharedUtil.HasLFGRestrictions(),
				() => g.StaticPopup_Show("CONFIRM_RESET_INSTANCES"),
			),
		];
		if (inside && g.C_ChallengeMode.IsChallengeModeResettable() && leader) {
			let energized = false;
			if (g.C_ChallengeMode.GetActiveKeystoneInfo)
				[, , energized] = g.C_ChallengeMode.GetActiveKeystoneInfo();
			instanceActions.push(
				makeOption(
					"reset-challenge",
					"Reset Challenge Mode",
					"button",
					false,
					!energized,
					() => g.StaticPopup_Show("CONFIRM_RESET_CHALLENGE_MODE"),
				),
			);
		}
		if (g.C_PartyInfo.ChallengeModeRestrictionsActive())
			instanceActions.push(
				makeOption(
					"abandon",
					"Vote to Abandon",
					"button",
					false,
					g.C_PartyInfo.CanStartInstanceAbandonVote(),
					() => g.C_PartyInfo.StartInstanceAbandonVote(),
				),
			);
		const groupActions: PlayerSettingsOption[] = [];
		if (
			!g.IsInGroup(g.LE_PARTY_CATEGORY_INSTANCE) &&
			g.UnitIsGroupLeader("player")
		)
			groupActions.push(
				makeOption(
					"convert",
					g.IsInRaid() ? "Convert to Party" : "Convert to Raid",
					"button",
					false,
					!g.IsInRaid() || g.GetNumGroupMembers() <= g.MEMBERS_PER_RAID_GROUP,
					() => {
						if (g.IsInRaid()) g.C_PartyInfo.ConvertToParty();
						else g.C_PartyInfo.ConvertToRaid();
					},
				),
			);
		if (
			g.IsInGroup() &&
			!g.IsInGroup(g.LE_PARTY_CATEGORY_INSTANCE) &&
			instanceType !== "pvp" &&
			instanceType !== "arena"
		)
			groupActions.push(
				makeOption("leave-group", "Leave Group", "button", false, true, () =>
					g.C_PartyInfo.LeaveParty(),
				),
			);
		if (g.PartyUtil.CanLeaveInstance())
			groupActions.push(
				makeOption(
					"leave-instance",
					g.C_PartyInfo.IsPartyWalkIn()
						? "Leave Instance"
						: "Leave Instance Group",
					"button",
					false,
					g.IsInGroup(),
					() => g.ConfirmOrLeaveParty(),
				),
			);
		if (
			g.C_Garrison.IsVisitGarrisonAvailable() &&
			!g.C_PartyInfo.IsCrossFactionParty()
		)
			groupActions.push(
				makeOption(
					"garrison",
					g.C_Garrison.IsUsingPartyGarrison()
						? "Return to Your Garrison"
						: "Visit Leader's Garrison",
					"button",
					false,
					true,
					() =>
						g.C_Garrison.SetUsingPartyGarrison(
							!g.C_Garrison.IsUsingPartyGarrison(),
						),
				),
			);
		const sections: PlayerSettingsSection[] = [
			pvpSection,
			{
				id: "loot",
				title: "Loot specialization",
				note: loot.length === 0 ? "Specializations unavailable" : undefined,
				options: loot,
			},
			{ id: "dungeon", title: "Dungeon difficulty", options: dungeon },
			{ id: "raid", title: "Raid difficulty", options: raid },
			{
				id: "legacy",
				title: "Legacy raid size",
				options: [3, 4].map((id) =>
					makeOption(
						`legacy:${id}`,
						id === 3 ? "10 player" : "25 player",
						"radio",
						legacyId === id,
						legacyEnabled,
						() => g.SetRaidDifficulties(false, id),
						id,
					),
				),
			},
			{ id: "reset", title: "Instances", options: instanceActions },
		];
		if (groupActions.length > 0)
			sections.push({ id: "group", title: "Group", options: groupActions });
		if (
			g.CanShowSetRoleButton() &&
			!g.C_Scenario.IsInScenario() &&
			g.IsInGroup() &&
			(g.OverrideLFGSetRoleRestriction() ||
				(!g.UnitPopupSharedUtil.HasLFGRestrictions() &&
					!g.UnitInPartyIsAI("player")))
		) {
			const [tank, healer, damage] = g.UnitGetAvailableRoles("player");
			const soft = g.AreClassRolesSoftSuggestions();
			const roles = [
				{ role: g.Enum.LFGRole.Tank, label: "Tank", enabled: tank || soft },
				{
					role: g.Enum.LFGRole.Healer,
					label: "Healer",
					enabled: healer || soft,
				},
				{
					role: g.Enum.LFGRole.Damage,
					label: "Damage",
					enabled: damage || soft,
				},
				{ role: undefined, label: "None", enabled: true },
			];
			sections.push({
				id: "role",
				title: "Group role",
				options: roles.map(({ role, label, enabled }) =>
					makeOption(
						`role:${role ?? "none"}`,
						label,
						"radio",
						g.UnitGroupRolesAssignedEnum("player") === role,
						enabled,
						() => g.UnitSetRoleEnum("player", role),
						role,
					),
				),
			});
		}
		return sections;
	}
	decorateGameMenu(game: NavGrid): NavGrid {
		if (!this.visible) return game;
		const left = this.presentation.grid();
		const result: NavGrid = [];
		for (let index = 0; index < Math.max(left.length, game.length); index++)
			result.push([
				...(left.at(index) ?? []).map((node) => ({ ...node, navColumn: 0 })),
				...(game.at(index) ?? []).map((node) => ({ ...node, navColumn: 1 })),
			]);
		return result;
	}
	getDialogs(): NativeDialog[] {
		return [];
	}
	shutdown(): void {
		this.active = false;
		this.visible = false;
		this.cancelPending?.();
		this.cancelPending = undefined;
		this.events.unsubscribe("PLAYER_SETTINGS_CHANGED", this.changed);
		this.presentation.destroy();
		this.controls.release();
	}
}
