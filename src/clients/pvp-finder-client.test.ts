import { afterEach, expect, it, vi } from "vitest";
import { PvpFinderClient } from "./pvp-finder-client";

afterEach(() => vi.unstubAllGlobals());

function button(name: string) {
	return {
		Title: { GetText: () => name },
		TeamSizeText: { GetText: () => "10 v 10" },
		toolTipTitle: name,
		modeDescription: "Capture the Flag",
		Reward: { honor: 150, experience: 0, IsShown: () => true },
		IsEnabled: () => true,
		canQueue: true,
	};
}
function setup() {
	const bonus = {
		RandomBGButton: button("Random Battleground"),
		RandomEpicBGButton: button("Random Epic Battleground"),
		Arena1Button: button("Arena Skirmish"),
		BrawlButton: button("Warsong Scramble"),
	};
	vi.stubGlobal("HonorFrame", {
		type: "bonus",
		BonusFrame: bonus,
		SpecificScrollBox: {},
		QueueButton: { IsEnabled: () => true },
	});
	vi.stubGlobal("ConquestFrame", {
		RatedSoloShuffle: button("Solo Shuffle"),
		RatedBGBlitz: button("Battleground Blitz"),
		Arena2v2: button("2v2"),
		Arena3v3: button("3v3"),
		RatedBG: button("Rated Battleground"),
		JoinButton: { IsEnabled: () => true },
	});
	vi.stubGlobal("TrainingGroundsFrame", {
		BonusTrainingGroundList: {
			BonusTrainingGroundButtons: [],
			Refresh: vi.fn(),
		},
		GetQueueButtonDisabledReason: () => undefined,
	});
	for (const fn of [
		"HonorFrameBonusFrame_Update",
		"HonorFrame_SetType",
		"HonorFrameBonusFrame_SelectButton",
		"ConquestFrame_Update",
		"ConquestFrame_SelectButton",
		"HonorFrame_UpdateQueueButtons",
	])
		vi.stubGlobal(fn, vi.fn());
	vi.stubGlobal("_G", {
		HONOR: "Honor",
		BONUS_BUTTON_RANDOM_BG_DESC: "Random maps",
	});
	vi.stubGlobal("C_PvP", {
		GetAvailableBrawlInfo: () => ({
			longDescription: "Capture the Flag",
			shortDescription: "10 v 10",
		}),
		GetBattlegroundInfo: () => ({
			battlegroundID: 2,
			name: "Warsong Gulch",
			canEnter: true,
			maxPlayers: 10,
			gameType: "Capture the Flag",
			longDescription: "Capture three flags",
			icon: 123,
		}),
		GetTrainingGrounds: () => [],
	});
	vi.stubGlobal("GetNumBattlegroundTypes", () => 1);
	Object.assign(_G, {
		HonorFrame: globalThisReflect("HonorFrame"),
		ConquestFrame: globalThisReflect("ConquestFrame"),
		TrainingGroundsFrame: globalThisReflect("TrainingGroundsFrame"),
		C_PvP,
		...Object.fromEntries(
			[
				"HonorFrameBonusFrame_Update",
				"HonorFrame_SetType",
				"HonorFrameBonusFrame_SelectButton",
				"ConquestFrame_Update",
				"ConquestFrame_SelectButton",
				"HonorFrame_UpdateQueueButtons",
				"GetNumBattlegroundTypes",
			].map((key) => [key, globalThisReflect(key)]),
		),
	});
	return bonus;
}

function api() {
	return _G as unknown as {
		HonorFrame: {
			type: string;
			BonusFrame: Record<string, ReturnType<typeof button>> & {
				selectedButton?: ReturnType<typeof button>;
			};
			SpecificScrollBox: { selectionID?: number };
			QueueButton: { IsEnabled(): boolean; tooltip?: string };
		};
		ConquestFrame: {
			selectedButton?: ReturnType<typeof button>;
			JoinButton: { IsEnabled(): boolean; tooltip?: string };
		};
		TrainingGroundsFrame: {
			BonusTrainingGroundList: {
				BonusTrainingGroundButtons: (ReturnType<typeof button> & {
					queueOption: string;
					tooltipDescription: string;
				})[];
				GetSelectedQueueOption(): string | undefined;
				SetSelectedQueueOption(option?: string): void;
			};
			GetQueueButtonDisabledReason(): string | undefined;
		};
		HonorFrameBonusFrame_SelectButton: ReturnType<typeof vi.fn>;
		HonorFrame_Queue: ReturnType<typeof vi.fn>;
		ConquestFrameJoinButton_OnClick: ReturnType<typeof vi.fn>;
		AcceptBattlefieldPort: ReturnType<typeof vi.fn>;
		GetBattlefieldStatus(id: number): string[];
		GetPVPRoles(): boolean[];
		SetPVPRoles: ReturnType<typeof vi.fn>;
		C_PvP: {
			GetTrainingGrounds(): object[];
			GetSpecialEventBrawlInfo(): object | undefined;
			JoinRandomTrainingGroundBattleground: ReturnType<typeof vi.fn>;
			JoinRandomTrainingGroundArena: ReturnType<typeof vi.fn>;
			JoinTrainingGround: ReturnType<typeof vi.fn>;
		};
	};
}

function setupActions() {
	const bonus = setup();
	const globals = api();
	Object.assign(_G, {
		HonorFrame_SetType: vi.fn((type: string) => {
			globals.HonorFrame.type = type;
		}),
		HonorFrameBonusFrame_SelectButton: vi.fn(
			(selected: ReturnType<typeof button>) => {
				globals.HonorFrame.BonusFrame.selectedButton = selected;
			},
		),
		ConquestFrame_SelectButton: vi.fn((selected: ReturnType<typeof button>) => {
			globals.ConquestFrame.selectedButton = selected;
		}),
		HonorFrame_Queue: vi.fn(),
		ConquestFrameJoinButton_OnClick: vi.fn(),
		GetMaxBattlefieldID: () => 0,
		GetBattlefieldStatus: () => ["none", ""],
		AcceptBattlefieldPort: vi.fn(),
		GetPVPRoles: () => [true, false, true],
		SetPVPRoles: vi.fn(),
		QueueUpdater: { RequestInfo: vi.fn() },
		RequestRatedInfo: vi.fn(),
		RequestPVPOptionsEnabled: vi.fn(),
		RequestRandomBattlegroundInstanceInfo: vi.fn(),
	});
	Object.assign(globals.C_PvP, {
		GetSpecialEventBrawlInfo: () => undefined,
		JoinRandomTrainingGroundBattleground: vi.fn(),
		JoinRandomTrainingGroundArena: vi.fn(),
		JoinTrainingGround: vi.fn(),
	});
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("C_LFGList", { GetAvailableRoles: () => [true, false, true] });
	vi.stubGlobal("LFG_UpdateAllRoleCheckboxes", vi.fn());
	vi.stubGlobal("IsLFGDungeonJoinable", () => [true, true, false]);
	let selection: string | undefined;
	globals.TrainingGroundsFrame.BonusTrainingGroundList.GetSelectedQueueOption =
		() => selection;
	globals.TrainingGroundsFrame.BonusTrainingGroundList.SetSelectedQueueOption =
		(option) => {
			selection = option;
		};
	globals.TrainingGroundsFrame.BonusTrainingGroundList.BonusTrainingGroundButtons =
		[
			{
				...button("Random Training Battleground"),
				queueOption: "RandomTrainingGround",
				tooltipDescription: "Learn against AI",
			},
			{
				...button("Random Training Arena"),
				queueOption: "RandomTrainingGroundArena",
				tooltipDescription: "Arena against AI",
			},
		];
	return { globals, bonus };
}

it.each([
	"RandomBGButton",
	"bg-2",
	"RatedSoloShuffle",
	"RandomTrainingGround",
	"RandomTrainingGroundArena",
	"training-9",
])("queues %s through the native action", (id) => {
	const { globals } = setupActions();
	globals.C_PvP.GetTrainingGrounds = () => [
		{
			lfgDungeonID: 9,
			name: "Training Warsong",
			maxPlayers: 10,
			gameType: "Capture the Flag",
		},
	];
	new PvpFinderClient().join(id);
	if (id === "RatedSoloShuffle")
		expect(globals.ConquestFrameJoinButton_OnClick).toHaveBeenCalledOnce();
	else if (id === "RandomTrainingGround")
		expect(
			globals.C_PvP.JoinRandomTrainingGroundBattleground,
		).toHaveBeenCalledOnce();
	else if (id === "RandomTrainingGroundArena")
		expect(globals.C_PvP.JoinRandomTrainingGroundArena).toHaveBeenCalledOnce();
	else if (id === "training-9")
		expect(globals.C_PvP.JoinTrainingGround).toHaveBeenCalledWith(9);
	else expect(globals.HonorFrame_Queue).toHaveBeenCalledOnce();
});

it("respects native queue restrictions and restores selection after reading activities", () => {
	const { globals, bonus } = setupActions();
	globals.HonorFrame.type = "specific";
	globals.HonorFrame.SpecificScrollBox.selectionID = 88;
	globals.HonorFrame.BonusFrame.selectedButton = bonus.Arena1Button;
	globals.ConquestFrame.selectedButton = button("Original");
	const previous = globals.ConquestFrame.selectedButton;
	globals.HonorFrame.QueueButton = {
		IsEnabled: () => false,
		tooltip: "Party too large",
	};
	globals.ConquestFrame.JoinButton = {
		IsEnabled: () => false,
		tooltip: "Item level too low",
	};
	const client = new PvpFinderClient();
	expect(
		client.getActivities().find((activity) => activity.id === "RandomBGButton"),
	).toMatchObject({ available: false, reason: "Party too large" });
	expect(
		client
			.getActivities()
			.find((activity) => activity.id === "RatedSoloShuffle"),
	).toMatchObject({ available: false, reason: "Item level too low" });
	client.join("RandomBGButton");
	client.join("RatedSoloShuffle");
	client.join("missing");
	expect(globals.HonorFrame_Queue).not.toHaveBeenCalled();
	expect(globals.ConquestFrameJoinButton_OnClick).not.toHaveBeenCalled();
	expect(globals.HonorFrame.SpecificScrollBox.selectionID).toBe(88);
	expect(globals.HonorFrame.type).toBe("specific");
	expect(globals.HonorFrameBonusFrame_SelectButton).toHaveBeenLastCalledWith(
		bonus.Arena1Button,
	);
	expect(globals.ConquestFrame.selectedButton).toBe(previous);
});

it("lists active queues and only leaves a matching queued activity, never a ready match", () => {
	const { globals } = setupActions();
	Object.assign(_G, { GetMaxBattlefieldID: () => 3 });
	globals.GetBattlefieldStatus = (id) =>
		id === 1
			? ["queued", "Warsong"]
			: id === 2
				? ["confirm", "Arena"]
				: ["none", ""];
	const client = new PvpFinderClient();
	expect(client.getQueues()).toEqual([
		{ id: 1, name: "Warsong", canLeave: true },
		{ id: 2, name: "Arena", canLeave: false },
	]);
	client.leave(1, "Old queue");
	client.leave(2, "Arena");
	expect(globals.AcceptBattlefieldPort).not.toHaveBeenCalled();
	client.leave(1, "Warsong");
	expect(globals.AcceptBattlefieldPort).toHaveBeenCalledWith(1, false);
});

it("uses PvP roles without leader selection and locks them while queued", () => {
	const { globals } = setupActions();
	const client = new PvpFinderClient();
	expect(client.getRoles()).toEqual({
		tank: true,
		healer: false,
		damage: true,
		leader: false,
	});
	client.toggleRole("leader");
	client.toggleRole("healer");
	expect(globals.SetPVPRoles).not.toHaveBeenCalled();
	client.toggleRole("tank");
	expect(globals.SetPVPRoles).toHaveBeenCalledWith(false, false, true);
	Object.assign(_G, {
		GetMaxBattlefieldID: () => 1,
		GetBattlefieldStatus: () => ["queued", "Warsong"],
	});
	client.toggleRole("damage");
	expect(globals.SetPVPRoles).toHaveBeenCalledOnce();
});

it("loads and requests native PvP data once while the Blizzard panels remain hidden", () => {
	setupActions();
	const client = new PvpFinderClient();
	client.getActivities();
	client.getActivities();
	expect(C_AddOns.LoadAddOn).toHaveBeenCalledExactlyOnceWith("Blizzard_PVPUI");
	expect(
		Reflect.get(_G, "RequestRandomBattlegroundInstanceInfo"),
	).toHaveBeenCalledOnce();
});

it("evaluates training availability with a selected activity and restores that selection", () => {
	const { globals } = setupActions();
	globals.TrainingGroundsFrame.GetQueueButtonDisabledReason = () =>
		globals.TrainingGroundsFrame.BonusTrainingGroundList.GetSelectedQueueOption()
			? undefined
			: "";
	const activities = new PvpFinderClient().getActivities();
	expect(
		activities.find((activity) => activity.id === "RandomTrainingGround"),
	).toMatchObject({ available: true, reason: undefined });
	expect(
		globals.TrainingGroundsFrame.BonusTrainingGroundList.GetSelectedQueueOption(),
	).toBeUndefined();
});

it("excludes random and player-ineligible specific training activities", () => {
	const { globals } = setupActions();
	globals.C_PvP.GetTrainingGrounds = () => [
		{
			lfgDungeonID: 9,
			name: "Random",
			isRandom: true,
			maxPlayers: 10,
			gameType: "Random",
		},
		{
			lfgDungeonID: 10,
			name: "Locked",
			maxPlayers: 10,
			gameType: "Capture the Flag",
		},
	];
	vi.stubGlobal("IsLFGDungeonJoinable", (id: number) => [
		id !== 10,
		id !== 10,
		false,
	]);
	expect(
		new PvpFinderClient()
			.getActivities()
			.filter((activity) => activity.id.startsWith("training-")),
	).toEqual([]);
});

it("keeps an optional special-event brawl accessible within Specific Battlegrounds", () => {
	const { globals } = setupActions();
	globals.HonorFrame.BonusFrame.BrawlButton2 = button("Special Brawl");
	globals.C_PvP.GetSpecialEventBrawlInfo = () => ({
		shortDescription: "15 v 15",
		longDescription: "Special rules",
	});
	const client = new PvpFinderClient();
	expect(
		client.getActivities().find((activity) => activity.id === "BrawlButton2"),
	).toMatchObject({
		section: "specific",
		name: "Special Brawl",
		description: "Special rules",
		available: true,
	});
	client.join("BrawlButton2");
	expect(globals.HonorFrame_Queue).toHaveBeenCalledOnce();
});

it("preserves item, currency and role shortage rewards and native level requirements", () => {
	const { bonus } = setupActions();
	Object.assign(bonus.RandomBGButton.Reward, {
		itemID: 42,
		currencyID: 7,
		quantity: 2,
		conquestAmount: 50,
		RoleShortageBonus: {
			IsShown: () => true,
			rewardInfo: {
				rewardItemID: 99,
				rewardSpell: { GetSpellDescription: () => "Extra rewards for healers" },
			},
		},
	});
	Object.assign(bonus.RandomEpicBGButton, {
		canQueue: false,
		LevelRequirement: {
			IsShown: () => true,
			GetText: () => "Unlocks at level 20",
		},
	});
	Object.assign(_G, { CONQUEST: "Conquest" });
	vi.stubGlobal("C_Item", {
		GetItemInfo: (id: number) => [id === 99 ? "Healer Crate" : "Reward Crate"],
	});
	vi.stubGlobal("C_CurrencyInfo", {
		GetCurrencyInfo: () => ({ name: "Marks" }),
	});
	const activities = new PvpFinderClient().getActivities();
	expect(activities.at(0)?.detail).toContain("2 Reward Crate");
	expect(activities.at(0)?.detail).toContain("2 Marks");
	expect(activities.at(0)?.detail).toContain("50 Conquest");
	expect(activities.at(0)?.detail).toContain("Healer Crate");
	expect(activities.at(0)?.detail).toContain("Extra rewards for healers");
	expect(activities.at(1)).toMatchObject({
		available: false,
		reason: "Unlocks at level 20",
	});
});

function globalThisReflect(key: string): unknown {
	return Reflect.get(globalThis, key);
}

it("publishes the four native bonus activities, five rated activities and specific battleground details", () => {
	setupActions();
	const activities = new PvpFinderClient().getActivities();
	expect(
		activities
			.filter((activity) => activity.section === "quick")
			.map((activity) => activity.name),
	).toEqual([
		"Random Battleground",
		"Random Epic Battleground",
		"Arena Skirmish",
		"Warsong Scramble",
	]);
	expect(
		activities.filter((activity) => activity.section === "rated"),
	).toHaveLength(5);
	expect(activities.find((activity) => activity.id === "bg-2")).toMatchObject({
		name: "Warsong Gulch",
		detail: "10 v 10 • Capture the Flag",
		description: "Capture three flags",
		icon: 123,
	});
	expect(activities.at(0)?.detail).toContain("150 Honor");
});
