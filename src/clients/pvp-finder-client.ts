import type { DungeonRole } from "./dungeon-finder-client";

export interface PvpActivity {
	readonly id: string;
	readonly section: "quick" | "rated" | "training" | "specific";
	readonly name: string;
	readonly detail: string;
	readonly description: string;
	readonly available: boolean;
	readonly reason?: string;
	readonly icon?: string | number;
}
export interface PvpQueue {
	readonly id: number;
	readonly name: string;
	readonly canLeave: boolean;
}
export interface IPvpFinderClient {
	getActivities(): PvpActivity[];
	join(id: string): void;
	getQueues(): PvpQueue[];
	leave(id: number, name: string): void;
	getRoles(): Record<DungeonRole, boolean>;
	getAvailableRoles(): Record<DungeonRole, boolean>;
	toggleRole(role: DungeonRole): void;
}

interface NativeButton {
	Title?: { GetText(): string | undefined };
	TeamSizeText?: { GetText(): string | undefined };
	CurrentRating?: { GetText(): string | undefined };
	LevelRequirement?: { GetText(): string | undefined; IsShown(): boolean };
	toolTipTitle?: string;
	tooltipTitle?: string;
	tooltipDescription?: string;
	modeDescription?: string;
	queueOption?: string;
	canQueue?: boolean;
	IsEnabled(): boolean;
	Reward?: {
		IsShown(): boolean;
		honor?: number;
		experience?: number;
		conquestAmount?: number;
		itemID?: number;
		currencyID?: number;
		quantity?: number;
		EnlistmentBonus?: { IsShown(): boolean };
		RoleShortageBonus?: {
			IsShown(): boolean;
			rewardInfo?: {
				rewardItemID: number;
				rewardSpell?: { GetSpellDescription(): string | undefined };
			};
		};
	};
}
interface Battleground {
	battlegroundID: number;
	lfgDungeonID: number;
	name: string;
	canEnter: boolean;
	isRandom: boolean;
	maxPlayers: number;
	gameType: string;
	shortDescription?: string;
	longDescription?: string;
	icon?: number;
}
interface NativePvp {
	HonorFrame: {
		type: string;
		BonusFrame: Record<string, NativeButton | undefined> & {
			selectedButton?: NativeButton;
		};
		SpecificScrollBox: { selectionID?: number };
		QueueButton: { IsEnabled(): boolean; tooltip?: string };
	};
	ConquestFrame: Record<(typeof ratedButtons)[number], NativeButton> & {
		selectedButton?: NativeButton;
		JoinButton: { IsEnabled(): boolean; tooltip?: string };
	};
	TrainingGroundsFrame: {
		BonusTrainingGroundList: {
			BonusTrainingGroundButtons: NativeButton[];
			Refresh(): void;
			GetSelectedQueueOption(): string | undefined;
			SetSelectedQueueOption(option?: string): void;
		};
		GetQueueButtonDisabledReason(): string | undefined;
	};
	HonorFrameBonusFrame_Update(this: void): void;
	HonorFrameBonusFrame_SelectButton(this: void, button: NativeButton): void;
	HonorFrame_SetType(this: void, type: string): void;
	HonorFrame_UpdateQueueButtons(this: void): void;
	HonorFrame_Queue(this: void): void;
	ConquestFrame_Update(this: void, frame: NativePvp["ConquestFrame"]): void;
	ConquestFrame_SelectButton(this: void, button: NativeButton): void;
	ConquestFrameJoinButton_OnClick(this: void): void;
	QueueUpdater: { RequestInfo(): void };
	RequestRatedInfo(this: void): void;
	RequestPVPOptionsEnabled(this: void): void;
	RequestRandomBattlegroundInstanceInfo(this: void): void;
	GetNumBattlegroundTypes(this: void): number;
	GetPVPRoles(this: void): LuaMultiReturn<[boolean, boolean, boolean]>;
	SetPVPRoles(
		this: void,
		tank: boolean,
		healer: boolean,
		damage: boolean,
	): void;
	GetMaxBattlefieldID(this: void): number;
	GetBattlefieldStatus(
		this: void,
		id: number,
	): LuaMultiReturn<[string, string]>;
	AcceptBattlefieldPort(this: void, id: number, accept: boolean): void;
	C_PvP: {
		GetBattlegroundInfo(this: void, index: number): Battleground | undefined;
		GetAvailableBrawlInfo(
			this: void,
		): { longDescription?: string; shortDescription?: string } | undefined;
		GetSpecialEventBrawlInfo(
			this: void,
		): { longDescription?: string; shortDescription?: string } | undefined;
		GetTrainingGrounds(this: void): Battleground[];
		JoinTrainingGround(this: void, id: number): void;
		JoinRandomTrainingGroundBattleground(this: void): void;
		JoinRandomTrainingGroundArena(this: void): void;
	};
}
const quickButtons = [
	"RandomBGButton",
	"RandomEpicBGButton",
	"Arena1Button",
	"BrawlButton",
] as const;
const quickDescriptions = [
	"BONUS_BUTTON_RANDOM_BG_DESC",
	"BONUS_BUTTON_RANDOM_LARGE_BG_DESC",
	"BONUS_BUTTON_SKIRMISH_DESC",
];
const ratedButtons = [
	"RatedSoloShuffle",
	"RatedBGBlitz",
	"Arena2v2",
	"Arena3v3",
	"RatedBG",
] as const;

// The generated API surface omits legacy helpers and structured PvP returns.
function native(): NativePvp {
	return _G as unknown as NativePvp;
}
function labels(): Record<string, string | undefined> {
	return _G as unknown as Record<string, string | undefined>;
}
function rewards(button: NativeButton): string[] {
	const reward = button.Reward;
	if (!reward?.IsShown()) return [];
	const parts: string[] = [];
	for (const [quantity, label] of [
		[reward.honor, labels().HONOR],
		[reward.experience, labels().XP],
		[reward.conquestAmount, labels().CONQUEST],
	] as const) {
		if (quantity !== undefined && quantity > 0 && label !== undefined)
			parts.push(`${quantity} ${label}`);
	}
	if (reward.itemID) {
		const [name] = C_Item.GetItemInfo(reward.itemID);
		if (name !== undefined) parts.push(`${reward.quantity ?? 1} ${name}`);
	}
	if (reward.currencyID) {
		const info = C_CurrencyInfo.GetCurrencyInfo(reward.currencyID) as unknown as
			| { name: string }
			| undefined;
		if (info) parts.push(`${reward.quantity ?? 1} ${info.name}`);
	}
	if (reward.EnlistmentBonus?.IsShown())
		parts.push(labels().PVP_ENLISTMENT_BONUS ?? "Enlistment Bonus");
	if (reward.RoleShortageBonus?.IsShown()) {
		const bonus = reward.RoleShortageBonus.rewardInfo;
		let item: string | undefined;
		if (bonus) {
			const [name] = C_Item.GetItemInfo(bonus.rewardItemID);
			item = name;
		}
		parts.push(item ?? "Role Shortage Bonus");
		const description = bonus?.rewardSpell?.GetSpellDescription();
		if (description !== undefined && description !== "")
			parts.push(description);
	}
	return parts;
}
function mapButton(
	id: string,
	section: PvpActivity["section"],
	button: NativeButton,
	description = "",
	detail = "",
	available = button.IsEnabled(),
	reason?: string,
): PvpActivity {
	const rating = button.CurrentRating?.GetText();
	return {
		id,
		section,
		name:
			button.Title?.GetText() ??
			button.toolTipTitle ??
			button.tooltipTitle ??
			"",
		description,
		detail: [
			detail || button.TeamSizeText?.GetText(),
			rating ? `${labels().PVP_RATING ?? "Rating"}: ${rating}` : undefined,
			...rewards(button),
		]
			.filter((part) => part !== undefined && part !== "")
			.join(" • "),
		available,
		reason:
			reason ??
			(!available && button.LevelRequirement?.IsShown()
				? button.LevelRequirement.GetText()
				: undefined),
		icon: "Interface\\Icons\\achievement_bg_winwsg",
	};
}
function mapBattleground(
	bg: Battleground,
	section: "specific" | "training",
	available: boolean,
	reason?: string,
): PvpActivity {
	return {
		id: `${section === "specific" ? "bg" : "training"}-${section === "specific" ? bg.battlegroundID : bg.lfgDungeonID}`,
		section,
		name: bg.name,
		available,
		reason,
		detail: `${bg.maxPlayers} v ${bg.maxPlayers} • ${bg.gameType}`,
		description: [bg.shortDescription, bg.longDescription]
			.filter((part) => part !== undefined && part !== "")
			.join("\n"),
		icon: bg.icon,
	};
}

export class PvpFinderClient implements IPvpFinderClient {
	private loaded = false;
	private initialize(): void {
		if (this.loaded) return;
		(C_AddOns.LoadAddOn as unknown as (this: void, name: string) => void)(
			"Blizzard_PVPUI",
		);
		this.loaded = true;
		const api = native();
		api.QueueUpdater.RequestInfo();
		api.RequestRatedInfo();
		api.RequestPVPOptionsEnabled();
		api.RequestRandomBattlegroundInstanceInfo();
	}
	getActivities(): PvpActivity[] {
		this.initialize();
		const api = native();
		api.HonorFrameBonusFrame_Update();
		api.ConquestFrame_Update(api.ConquestFrame);
		const activities: PvpActivity[] = [];
		const honor = api.HonorFrame;
		const oldType = honor.type;
		const oldBonus = honor.BonusFrame.selectedButton;
		const oldBg = honor.SpecificScrollBox.selectionID;
		api.HonorFrame_SetType("bonus");
		quickButtons.forEach((key, index) => {
			const button = honor.BonusFrame[key];
			if (!button) return;
			api.HonorFrameBonusFrame_SelectButton(button);
			const brawl =
				key === "BrawlButton" ? api.C_PvP.GetAvailableBrawlInfo() : undefined;
			activities.push(
				mapButton(
					key,
					"quick",
					button,
					brawl?.longDescription ??
						labels()[quickDescriptions.at(index) ?? ""] ??
						"",
					brawl?.shortDescription,
					button.canQueue === true && honor.QueueButton.IsEnabled(),
					honor.QueueButton.tooltip,
				),
			);
		});
		const specialBrawl = api.C_PvP.GetSpecialEventBrawlInfo();
		const specialButton = honor.BonusFrame.BrawlButton2;
		if (specialBrawl && specialButton) {
			api.HonorFrameBonusFrame_SelectButton(specialButton);
			activities.push(
				mapButton(
					"BrawlButton2",
					"specific",
					specialButton,
					specialBrawl.longDescription,
					specialBrawl.shortDescription,
					specialButton.canQueue === true && honor.QueueButton.IsEnabled(),
					honor.QueueButton.tooltip,
				),
			);
		}
		api.HonorFrame_SetType("specific");
		for (let index = 1; index <= api.GetNumBattlegroundTypes(); index++) {
			const bg = api.C_PvP.GetBattlegroundInfo(index);
			if (!bg?.name || !bg.canEnter || bg.isRandom) continue;
			honor.SpecificScrollBox.selectionID = bg.battlegroundID;
			api.HonorFrame_UpdateQueueButtons();
			activities.push(
				mapBattleground(
					bg,
					"specific",
					honor.QueueButton.IsEnabled(),
					honor.QueueButton.tooltip,
				),
			);
		}
		honor.SpecificScrollBox.selectionID = oldBg;
		if (oldBonus) api.HonorFrameBonusFrame_SelectButton(oldBonus);
		api.HonorFrame_SetType(oldType);
		api.HonorFrame_UpdateQueueButtons();
		const oldRated = api.ConquestFrame.selectedButton;
		for (const key of ratedButtons) {
			const button = api.ConquestFrame[key];
			if (!button) continue;
			api.ConquestFrame_SelectButton(button);
			activities.push(
				mapButton(
					key,
					"rated",
					button,
					button.modeDescription,
					"",
					button.IsEnabled() && api.ConquestFrame.JoinButton.IsEnabled(),
					api.ConquestFrame.JoinButton.tooltip,
				),
			);
		}
		if (oldRated) api.ConquestFrame_SelectButton(oldRated);
		const training = api.TrainingGroundsFrame;
		training.BonusTrainingGroundList.Refresh();
		const oldTraining =
			training.BonusTrainingGroundList.GetSelectedQueueOption();
		training.BonusTrainingGroundList.SetSelectedQueueOption(
			"RandomTrainingGround",
		);
		const trainingReason = training.GetQueueButtonDisabledReason();
		for (const button of training.BonusTrainingGroundList
			.BonusTrainingGroundButtons) {
			if (!button.queueOption) continue;
			activities.push(
				mapButton(
					button.queueOption,
					"training",
					button,
					button.tooltipDescription,
					"",
					button.IsEnabled() && trainingReason === undefined,
					trainingReason,
				),
			);
		}
		for (const bg of api.C_PvP.GetTrainingGrounds()) {
			if (bg.isRandom) continue;
			const [available, playerAvailable] = IsLFGDungeonJoinable(
				bg.lfgDungeonID,
			);
			if (!playerAvailable) continue;
			activities.push(
				mapBattleground(
					bg,
					"training",
					available && trainingReason === undefined,
					trainingReason,
				),
			);
		}
		training.BonusTrainingGroundList.SetSelectedQueueOption(oldTraining);
		return activities;
	}
	join(id: string): void {
		if (
			!this.getActivities().some(
				(activity) => activity.id === id && activity.available,
			)
		)
			return;
		const api = native();
		if (quickButtons.some((key) => key === id) || id === "BrawlButton2") {
			api.HonorFrame_SetType("bonus");
			const button = api.HonorFrame.BonusFrame[id];
			if (button) api.HonorFrameBonusFrame_SelectButton(button);
			if (api.HonorFrame.QueueButton.IsEnabled()) api.HonorFrame_Queue();
		} else if (id.startsWith("bg-")) {
			api.HonorFrame_SetType("specific");
			api.HonorFrame.SpecificScrollBox.selectionID = Number(id.slice(3));
			api.HonorFrame_UpdateQueueButtons();
			if (api.HonorFrame.QueueButton.IsEnabled()) api.HonorFrame_Queue();
		} else if (ratedButtons.some((key) => key === id)) {
			const key = ratedButtons.find((key) => key === id);
			if (key === undefined) return;
			api.ConquestFrame_SelectButton(api.ConquestFrame[key]);
			if (api.ConquestFrame.JoinButton.IsEnabled())
				api.ConquestFrameJoinButton_OnClick();
		} else if (id === "RandomTrainingGround")
			api.C_PvP.JoinRandomTrainingGroundBattleground();
		else if (id === "RandomTrainingGroundArena")
			api.C_PvP.JoinRandomTrainingGroundArena();
		else if (id.startsWith("training-"))
			api.C_PvP.JoinTrainingGround(Number(id.slice(9)));
	}
	getQueues(): PvpQueue[] {
		const api = native();
		const queues: PvpQueue[] = [];
		for (let id = 1; id <= api.GetMaxBattlefieldID(); id++) {
			const [status, name] = api.GetBattlefieldStatus(id);
			if (status !== "none")
				queues.push({ id, name, canLeave: status === "queued" });
		}
		return queues;
	}
	leave(id: number, name: string): void {
		const api = native();
		const [status, currentName] = api.GetBattlefieldStatus(id);
		if (status === "queued" && name === currentName)
			api.AcceptBattlefieldPort(id, false);
	}
	getRoles(): Record<DungeonRole, boolean> {
		const [tank, healer, damage] = native().GetPVPRoles();
		return { tank, healer, damage, leader: false };
	}
	getAvailableRoles(): Record<DungeonRole, boolean> {
		const [tank, healer, damage] = C_LFGList.GetAvailableRoles();
		return { tank, healer, damage, leader: false };
	}
	toggleRole(role: DungeonRole): void {
		if (!this.getAvailableRoles()[role] || this.getQueues().length > 0) return;
		const roles = this.getRoles();
		roles[role] = !roles[role];
		native().SetPVPRoles(roles.tank, roles.healer, roles.damage);
		LFG_UpdateAllRoleCheckboxes();
	}
}
