import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DialogueClient } from "./dialogue-client";

const gossip = {
	GetText: () => "Greetings",
	GetAvailableQuests: () => [{ questID: 81, title: "Offer" }],
	GetActiveQuests: () => [{ questID: 82, title: "Return", isComplete: false }],
	GetOptions: () => [
		{ gossipOptionID: 401, orderIndex: 9, name: "Travel", status: 0 },
		{ orderIndex: 12, name: "Special", status: 0 },
		{
			gossipOptionID: 402,
			orderIndex: 13,
			name: "Locked",
			status: 1,
			failureDescription: "Unavailable",
		},
	],
	SelectAvailableQuest: vi.fn(),
	SelectActiveQuest: vi.fn(),
	SelectOption: vi.fn(),
	SelectOptionByIndex: vi.fn(),
	CloseGossip: vi.fn(),
};
beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("C_GossipInfo", gossip);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("UnitGUID", () => "npc-1");
	vi.stubGlobal("UnitName", () => ["Keeper"]);
	for (const [name, result] of Object.entries({
		GetQuestID: 51,
		GetTitleText: "Quest",
		GetQuestText: "Full text",
		GetObjectiveText: "Objectives",
		GetProgressText: "Progress",
		GetRewardText: "Thanks",
		QuestGetAutoAccept: false,
		QuestFlagsPVP: false,
		IsQuestCompletable: true,
		GetQuestMoneyToGet: 0,
		GetMoney: 100,
		GetNumQuestItems: 0,
		GetNumQuestCurrencies: 0,
		GetNumQuestRewards: 0,
		GetNumQuestChoices: 0,
		GetRewardMoney: 0,
		GetRewardXP: 100,
		GetRewardHonor: 0,
		GetRewardTitle: undefined,
		GetQuestItemLink: undefined,
	}))
		vi.stubGlobal(name, () => result);
	vi.stubGlobal("C_QuestInfoSystem", {
		GetQuestRewardCurrencies: () => [],
		GetQuestRewardSpells: () => [],
	});
	vi.stubGlobal("C_QuestOffer", {
		GetQuestOfferMajorFactionReputationRewards: () => [],
	});
	vi.stubGlobal("C_QuestLog", {
		IsQuestDisabledForSession: () => false,
		GetNumQuestLogEntries: () => [0, 0],
		GetMaxNumQuestsCanAccept: () => 35,
		GetTitleForQuestID: () => "Remote quest",
		IsComplete: () => true,
	});
	vi.stubGlobal("C_Reputation", {
		GetFactionDataByID: () => ({ name: "Faction" }),
	});
	vi.stubGlobal("GetRewardSkillPoints", () => []);
	vi.stubGlobal("GetRewardArtifactXP", () => []);
	for (const name of [
		"AcceptQuest",
		"AcknowledgeAutoAcceptQuest",
		"CompleteQuest",
		"GetQuestReward",
		"DeclineQuest",
		"CloseQuest",
		"ConfirmAcceptQuest",
		"ShowQuestComplete",
	])
		vi.stubGlobal(name, vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

it("supplies complete item, currency and spell links for reward inspection", () => {
	vi.stubGlobal("GetNumQuestRewards", () => 1);
	vi.stubGlobal("GetQuestItemInfo", () => ["Sword", 123, 1]);
	vi.stubGlobal("GetQuestItemLink", () => "item:456");
	vi.stubGlobal("C_QuestInfoSystem", {
		GetQuestRewardCurrencies: () => [
			{ name: "Tokens", texture: 12, totalRewardAmount: 5, currencyID: 789 },
		],
		GetQuestRewardSpells: () => [101],
		GetQuestRewardSpellInfo: () => ({ name: "Training", texture: 13 }),
	});
	const page = new DialogueClient().read("rewards");
	if (page.kind !== "rewards") throw new Error("Expected rewards");
	expect(page.rewards.map((r) => r.tooltipLink)).toEqual([
		"item:456",
		"currency:789",
		"spell:101",
		undefined,
	]);
});

it("uses gossip IDs and the documented orderIndex for identifier-less options", () => {
	const c = new DialogueClient();
	const s = c.read("gossip");
	expect(s.kind).toBe("gossip");
	if (s.kind !== "gossip") return;
	expect(s.entries.map((e) => e.id)).toEqual([
		"available:81",
		"active:82",
		"option:401",
		"index:12",
		"option:402",
	]);
	expect(s.entries.at(1)?.detail).toBe("Incomplete");
	expect(s.entries.at(4)?.disabled).toBe(true);
	c.select(s, "available:81");
	expect(gossip.SelectAvailableQuest).toHaveBeenCalledWith(81);
	c.select(c.read("gossip"), "option:401");
	expect(gossip.SelectOption).toHaveBeenCalledWith(401);
	c.select(c.read("gossip"), "index:12");
	expect(gossip.SelectOptionByIndex).toHaveBeenCalledWith(12);
	expect(c.select(c.read("gossip"), "option:402").ok).toBe(false);
});
it("uses separate quest greeting indices, never gossip APIs", () => {
	vi.stubGlobal("GetGreetingText", () => "Hello");
	vi.stubGlobal("GetNumAvailableQuests", () => 1);
	vi.stubGlobal("GetNumActiveQuests", () => 1);
	vi.stubGlobal("GetAvailableTitle", () => "New");
	vi.stubGlobal("GetActiveTitle", () => ["Done", true]);
	const select = vi.fn();
	vi.stubGlobal("SelectAvailableQuest", select);
	const c = new DialogueClient();
	const s = c.read("greeting");
	c.select(s, "greeting-available:1");
	expect(select).toHaveBeenCalledWith(1);
	expect(gossip.SelectAvailableQuest).not.toHaveBeenCalled();
});
it("rejects repeated actions, stale revisions, changed NPCs and changed quest IDs", () => {
	const c = new DialogueClient();
	const s = c.read("offer");
	expect(c.accept(s).ok).toBe(true);
	expect(c.accept(s).ok).toBe(false);
	expect(AcceptQuest).toHaveBeenCalledOnce();
	const next = c.read("offer");
	vi.stubGlobal("GetQuestID", () => 99);
	expect(c.accept(next).ok).toBe(false);
	vi.stubGlobal("GetQuestID", () => 51);
	const npc = c.read("offer");
	vi.stubGlobal("UnitGUID", () => "npc-2");
	expect(c.accept(npc).ok).toBe(false);
});
it("acknowledges autoaccept without accepting again and requires PvP confirmation", () => {
	vi.stubGlobal("QuestGetAutoAccept", () => true);
	const c = new DialogueClient();
	c.accept(c.read("offer"));
	expect(AcknowledgeAutoAcceptQuest).toHaveBeenCalledOnce();
	expect(AcceptQuest).not.toHaveBeenCalled();
	vi.stubGlobal("QuestGetAutoAccept", () => false);
	vi.stubGlobal("QuestFlagsPVP", () => true);
	const s = c.read("offer");
	expect(c.accept(s).ok).toBe(false);
	expect(c.accept(s, true).ok).toBe(true);
});
it("revalidates progress, reward selection and quest costs", () => {
	const c = new DialogueClient();
	vi.stubGlobal("IsQuestCompletable", () => false);
	expect(c.advance(c.read("progress")).ok).toBe(false);
	expect(CompleteQuest).not.toHaveBeenCalled();
	vi.stubGlobal("GetNumQuestChoices", () => 2);
	vi.stubGlobal("GetQuestItemInfo", () => [undefined, undefined, 1]);
	vi.stubGlobal("GetQuestItemInfoLootType", () => 0);
	const s = c.read("rewards");
	expect(c.claim(s).ok).toBe(false);
	expect(c.claim(s, 3).ok).toBe(false);
	vi.stubGlobal("GetQuestMoneyToGet", () => 50);
	expect(c.claim(s, 2, true).ok).toBe(false);
	const priced = c.read("rewards");
	expect(c.claim(priced, 2).ok).toBe(false);
	expect(c.claim(priced, 2, true).ok).toBe(true);
	expect(GetQuestReward).toHaveBeenCalledExactlyOnceWith(2);
});
it.each([0, 1])("claims %i choices with the correct reward index", (count) => {
	vi.stubGlobal("GetNumQuestChoices", () => count);
	vi.stubGlobal("GetQuestItemInfo", () => ["Reward", 1, 1]);
	vi.stubGlobal("GetQuestItemInfoLootType", () => 0);
	const c = new DialogueClient();
	expect(c.claim(c.read("rewards"), count).ok).toBe(true);
	expect(GetQuestReward).toHaveBeenCalledWith(count);
});
it("submits confirmed gossip and code with the event ID; cancellation calls nothing", () => {
	const c = new DialogueClient();
	const s = c.read("gossip");
	c.prompt(s, { kind: "gossip", optionID: 401, text: "Pay?", cost: 50 });
	c.cancelPrompt();
	expect(gossip.SelectOption).not.toHaveBeenCalled();
	c.prompt(s, { kind: "code", optionID: 401, text: "Code", cost: 0 });
	c.confirm(s, "secret");
	expect(gossip.SelectOption).toHaveBeenCalledExactlyOnceWith(
		401,
		"secret",
		true,
	);
	expect(c.confirm(s, "secret").ok).toBe(false);
});
it("blocks all commits in combat and invalidates sessions on close", () => {
	const c = new DialogueClient();
	const s = c.read("offer");
	vi.stubGlobal("InCombatLockdown", () => true);
	expect(c.accept(s).ok).toBe(false);
	vi.stubGlobal("InCombatLockdown", () => false);
	c.end();
	expect(c.accept(s).ok).toBe(false);
});
it("opens remote completion for the event quest and preserves item-started offers", () => {
	const c = new DialogueClient();
	const remote = c.read("remote", undefined, 97);
	expect(remote.speaker).toBe("Quest");
	c.advance(remote);
	expect(ShowQuestComplete).toHaveBeenCalledExactlyOnceWith(97);
	const item = c.read("offer", 301);
	expect(item.kind === "offer" && item.startItem).toBe(301);
	c.accept(item);
	expect(AcceptQuest).toHaveBeenCalledOnce();
});
it("confirms shared quests with the authoritative title and rejects a full quest log", () => {
	const c = new DialogueClient();
	const s = c.read("shared", undefined, 81, "Friend", "Shared title");
	expect(s.title).toBe("Shared title");
	c.accept(s);
	expect(ConfirmAcceptQuest).toHaveBeenCalledOnce();
	vi.stubGlobal("C_QuestLog", {
		GetNumQuestLogEntries: () => [35, 35],
		GetMaxNumQuestsCanAccept: () => 35,
		GetTitleForQuestID: () => "Shared title",
	});
	expect(c.accept(c.read("shared", undefined, 81)).ok).toBe(false);
});
it("shows items, currencies, money, XP, spells, skill, honor, title and reputation rewards", () => {
	vi.stubGlobal("GetNumQuestRewards", () => 1);
	vi.stubGlobal("GetQuestItemInfo", () => ["Sword", 1, 2]);
	vi.stubGlobal("GetRewardMoney", () => 10000);
	vi.stubGlobal("GetRewardHonor", () => 20);
	vi.stubGlobal("GetRewardTitle", () => "Champion");
	vi.stubGlobal("GetRewardSkillPoints", () => ["Alchemy", 5, 1]);
	vi.stubGlobal("GetRewardArtifactXP", () => [500, 1]);
	vi.stubGlobal("C_QuestInfoSystem", {
		GetQuestRewardCurrencies: () => [
			{ currencyID: 5, name: "Tokens", texture: 1, totalRewardAmount: 4 },
		],
		GetQuestRewardSpells: () => [8],
		GetQuestRewardSpellInfo: () => ({ name: "New spell", texture: 2 }),
	});
	vi.stubGlobal("C_QuestOffer", {
		GetQuestOfferMajorFactionReputationRewards: () => [
			{ factionID: 1, rewardAmount: 200 },
		],
	});
	const page = new DialogueClient().read("rewards");
	if (page.kind !== "rewards") return;
	expect(page.rewards.map((r) => r.id)).toEqual([
		"reward:1",
		"currency:5",
		"spell:8",
		"money",
		"xp",
		"honor",
		"title",
		"skill",
		"artifact",
		"rep:1",
	]);
});
it("reports incomplete item, currency and money requirements", () => {
	vi.stubGlobal("GetNumQuestItems", () => 1);
	vi.stubGlobal("GetNumQuestCurrencies", () => 1);
	vi.stubGlobal("GetQuestMoneyToGet", () => 200);
	vi.stubGlobal("GetQuestItemInfo", () => ["Tokens", 1, 4, 1, true, 70]);
	vi.stubGlobal("C_Item", { GetItemCount: () => 1 });
	vi.stubGlobal("C_CurrencyInfo", { GetCurrencyInfo: () => ({ quantity: 2 }) });
	vi.stubGlobal("C_QuestOffer", {
		GetQuestOfferMajorFactionReputationRewards: () => [],
		GetQuestRequiredCurrencyInfo: () => ({
			name: "Currency",
			currencyID: 8,
			requiredAmount: 5,
		}),
	});
	const page = new DialogueClient().read("progress");
	if (page.kind !== "progress") return;
	expect(page.completable).toBe(false);
	expect(page.requirements.map((r) => r.detail)).toEqual([
		"1/4 · Incomplete",
		"2/5 · Incomplete",
		"Not enough money",
	]);
});
it("rejects late item refresh from another quest and cannot resubmit after refresh", () => {
	const c = new DialogueClient();
	const p = c.read("offer");
	c.accept(p);
	const refreshed = c.refresh(p);
	if (!refreshed) throw new Error("Expected refreshed offer");
	expect(c.accept(refreshed).ok).toBe(false);
	vi.stubGlobal("GetQuestID", () => 90);
	expect(c.refresh(refreshed)).toBeUndefined();
});
