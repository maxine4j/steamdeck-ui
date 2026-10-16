import { formatMoney as dialogueMoney } from "../utils/money";

/** Narrow legacy API declarations, kept at the client boundary. */
declare global {
	function GetQuestID(this: void): number;
	function GetTitleText(this: void): string;
	function GetQuestText(this: void): string;
	function GetObjectiveText(this: void): string;
	function GetProgressText(this: void): string;
	function GetRewardText(this: void): string;
	function GetGreetingText(this: void): string;
	function GetNumAvailableQuests(this: void): number;
	function GetNumActiveQuests(this: void): number;
	function GetAvailableTitle(this: void, index: number): string;
	function GetActiveTitle(
		this: void,
		index: number,
	): LuaMultiReturn<[string, boolean]>;
	function SelectAvailableQuest(this: void, index: number): void;
	function SelectActiveQuest(this: void, index: number): void;
	function QuestGetAutoAccept(this: void): boolean;
	function QuestFlagsPVP(this: void): boolean;
	function IsQuestCompletable(this: void): boolean;
	function GetQuestMoneyToGet(this: void): number;
	function GetNumQuestItems(this: void): number;
	function GetNumQuestCurrencies(this: void): number;
	function GetNumQuestRewards(this: void): number;
	function GetNumQuestChoices(this: void): number;
	function GetQuestItemLink(
		this: void,
		kind: string,
		index: number,
	): string | undefined;
	function GetQuestItemInfo(
		this: void,
		kind: string,
		index: number,
	): LuaMultiReturn<
		[
			string | undefined,
			number | undefined,
			number,
			number,
			boolean,
			number | undefined,
		]
	>;
	function GetQuestItemInfoLootType(
		this: void,
		kind: string,
		index: number,
	): number;
	function GetRewardMoney(this: void): number;
	function GetRewardXP(this: void): number;
	function GetRewardHonor(this: void): number;
	function GetRewardTitle(this: void): string | undefined;
	function GetRewardSkillPoints(
		this: void,
	): LuaMultiReturn<[string | undefined, number | undefined, number]>;
	function GetRewardArtifactXP(this: void): LuaMultiReturn<[number, number]>;
	function AcceptQuest(this: void): void;
	function AcknowledgeAutoAcceptQuest(this: void): void;
	function CompleteQuest(this: void): void;
	function GetQuestReward(this: void, index: number): void;
	function DeclineQuest(this: void): void;
	function CloseQuest(this: void): void;
	function ConfirmAcceptQuest(this: void): void;
	function ShowQuestComplete(this: void, questID: number): void;
}

export interface DialogueEntry {
	readonly id: string;
	readonly label: string;
	readonly detail?: string;
	readonly disabled?: boolean;
	readonly icon?: number;
	readonly tooltipLink?: string;
}
export interface DialogueReward extends DialogueEntry {
	readonly index?: number;
}
interface PageIdentity {
	readonly session: number;
	readonly revision: number;
	readonly speaker: string;
	readonly source?: string;
}
interface PageContent extends PageIdentity {
	readonly title: string;
	readonly text: string;
}
interface QuestContent extends PageContent {
	readonly questID: number;
	readonly rewards: readonly DialogueReward[];
	readonly choices: readonly DialogueReward[];
	readonly cost: number;
}
export type DialoguePage =
	| (PageContent & {
			readonly kind: "gossip" | "greeting";
			readonly entries: readonly DialogueEntry[];
	  })
	| (QuestContent & {
			readonly kind: "offer";
			readonly autoAccepted: boolean;
			readonly pvp: boolean;
			readonly startItem?: number;
	  })
	| (QuestContent & {
			readonly kind: "progress";
			readonly completable: boolean;
			readonly requirements: readonly DialogueEntry[];
	  })
	| (QuestContent & { readonly kind: "rewards" })
	| (PageContent & { readonly kind: "remote"; readonly questID: number })
	| (PageContent & {
			readonly kind: "shared";
			readonly questID: number;
			readonly eligible: boolean;
	  });
export type DialogueKind = DialoguePage["kind"];
export interface DialoguePrompt {
	readonly kind: "gossip" | "code";
	readonly optionID: number;
	readonly text: string;
	readonly cost: number;
}
export interface DialogueResult {
	readonly ok: boolean;
	readonly reason?: string;
}
export interface IDialogueClient {
	read(
		kind: DialogueKind,
		startItem?: number,
		questID?: number,
		speaker?: string,
		title?: string,
	): DialoguePage;
	refresh(page: DialoguePage): DialoguePage | undefined;
	select(page: DialoguePage, entryID: string): DialogueResult;
	accept(page: DialoguePage, confirmed?: boolean): DialogueResult;
	advance(page: DialoguePage): DialogueResult;
	claim(
		page: DialoguePage,
		index?: number,
		confirmed?: boolean,
	): DialogueResult;
	prompt(page: DialoguePage, prompt: DialoguePrompt): void;
	confirm(page: DialoguePage, code?: string): DialogueResult;
	cancelPrompt(): void;
	close(page: DialoguePage): void;
	end(): void;
	isInCombat(): boolean;
	isDialogueInteraction(interactionType: number): boolean;
}
interface GossipQuest {
	questID: number;
	title: string;
	isComplete?: boolean;
}
interface GossipOption {
	gossipOptionID?: number;
	orderIndex?: number;
	name: string;
	icon?: number;
	status: number;
	failureDescription?: string;
}
interface CurrencyReward {
	name: string;
	texture: number;
	totalRewardAmount: number;
	currencyID: number;
	requiredAmount?: number;
}
interface SpellReward {
	name: string;
	texture: number;
}
interface ReputationReward {
	factionID: number;
	rewardAmount: number;
}

// Generated list return types are incorrect; these contracts match bundled Retail source.
const gossipAPI = () =>
	C_GossipInfo as unknown as {
		GetAvailableQuests(this: void): GossipQuest[];
		GetActiveQuests(this: void): GossipQuest[];
		GetOptions(this: void): GossipOption[];
	};
const questInfoAPI = () =>
	C_QuestInfoSystem as unknown as {
		GetQuestRewardCurrencies(this: void, questID: number): CurrencyReward[];
		GetQuestRewardSpells(this: void, questID: number): number[];
		GetQuestRewardSpellInfo(
			this: void,
			questID: number,
			spellID: number,
		): SpellReward | undefined;
	};
const offerAPI = () =>
	C_QuestOffer as unknown as {
		GetQuestRewardCurrencyInfo(
			this: void,
			kind: string,
			index: number,
		): CurrencyReward | undefined;
		GetQuestRequiredCurrencyInfo(
			this: void,
			index: number,
		): CurrencyReward | undefined;
		GetQuestOfferMajorFactionReputationRewards(
			this: void,
		): ReputationReward[] | undefined;
	};

export { formatMoney as dialogueMoney } from "../utils/money";

/** Authoritative snapshots and guarded original API actions. No native UI visibility state. */
export class DialogueClient implements IDialogueClient {
	private session = 0;
	private revision = 0;
	private current?: DialoguePage;
	private submitted = false;
	private pending?: { page: DialoguePage; prompt: DialoguePrompt };
	isInCombat(): boolean {
		return InCombatLockdown();
	}
	isDialogueInteraction(interactionType: number): boolean {
		return interactionType === 3 || interactionType === 4;
	}
	private source(): string | undefined {
		const guid = UnitGUID as unknown as (
			this: void,
			unit: string,
		) => string | undefined;
		return guid("questnpc") ?? guid("npc");
	}
	read(
		kind: DialogueKind,
		startItem?: number,
		remoteID?: number,
		speaker?: string,
		sharedTitle?: string,
	): DialoguePage {
		const source =
			kind === "remote" || kind === "shared" ? undefined : this.source();
		if (!this.current || source !== this.current.source) this.session++;
		const name = UnitName as unknown as (
			this: void,
			unit: string,
		) => LuaMultiReturn<[string | undefined]>;
		const [npcName] = name("questnpc");
		const [gossipName] = name("npc");
		const identity: PageIdentity = {
			session: this.session,
			revision: ++this.revision,
			source,
			speaker:
				speaker ??
				(kind === "remote" || kind === "shared" || startItem
					? "Quest"
					: (npcName ?? gossipName)) ??
				"Quest",
		};
		let page: DialoguePage;
		if (kind === "gossip" || kind === "greeting") {
			const entries: DialogueEntry[] = [];
			if (kind === "gossip") {
				for (const q of gossipAPI().GetAvailableQuests()) {
					const disabled = C_QuestLog.IsQuestDisabledForSession(q.questID);
					entries.push({
						id: `available:${q.questID}`,
						label: q.title,
						disabled,
						detail: disabled
							? "Unavailable in this quest session"
							: "Available quest",
					});
				}
				for (const q of gossipAPI().GetActiveQuests())
					entries.push({
						id: `active:${q.questID}`,
						label: q.title,
						detail: q.isComplete ? "Complete" : "Incomplete",
					});
				for (const o of gossipAPI()
					.GetOptions()
					.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)))
					entries.push({
						id:
							o.gossipOptionID !== undefined
								? `option:${o.gossipOptionID}`
								: `index:${o.orderIndex ?? 0}`,
						label: o.name,
						icon: o.icon,
						disabled:
							o.status === 1 ||
							o.status === 2 ||
							(o.gossipOptionID === undefined && o.orderIndex === undefined),
						detail:
							o.failureDescription ||
							(o.status === 3 ? "Already complete" : undefined),
					});
			} else {
				for (let i = 1; i <= GetNumAvailableQuests(); i++) {
					const title = GetAvailableTitle(i);
					entries.push({
						id: `greeting-available:${i}`,
						label: title,
						detail: "Available quest",
					});
				}
				for (let i = 1; i <= GetNumActiveQuests(); i++) {
					const [title, complete] = GetActiveTitle(i);
					entries.push({
						id: `greeting-active:${i}`,
						label: title,
						detail: complete ? "Complete" : "Incomplete",
					});
				}
			}
			page = {
				...identity,
				kind,
				title: "Conversation",
				text: kind === "gossip" ? C_GossipInfo.GetText() : GetGreetingText(),
				entries,
			};
		} else if (kind === "remote" || kind === "shared") {
			const questID = remoteID ?? 0;
			const [, count] = C_QuestLog.GetNumQuestLogEntries();
			page =
				kind === "remote"
					? {
							...identity,
							kind,
							questID,
							title: C_QuestLog.GetTitleForQuestID(questID) ?? "Quest complete",
							text: "This quest can be completed remotely. Review its rewards before claiming.",
						}
					: {
							...identity,
							kind,
							questID,
							title:
								sharedTitle ??
								C_QuestLog.GetTitleForQuestID(questID) ??
								"Shared quest",
							text: `${speaker ?? "A party member"} offers you this quest.`,
							eligible: count < C_QuestLog.GetMaxNumQuestsCanAccept(),
						};
		} else {
			const questID = GetQuestID();
			const common: QuestContent = {
				...identity,
				questID,
				title: GetTitleText(),
				text:
					kind === "offer"
						? `${GetQuestText()}\n\nObjectives\n${GetObjectiveText()}`
						: kind === "progress"
							? GetProgressText()
							: GetRewardText(),
				cost: GetQuestMoneyToGet() ?? 0,
				...this.rewards(questID),
			};
			page =
				kind === "offer"
					? {
							...common,
							kind,
							startItem,
							autoAccepted: QuestGetAutoAccept(),
							pvp: QuestFlagsPVP(),
						}
					: kind === "progress"
						? {
								...common,
								kind,
								completable: IsQuestCompletable() && GetMoney() >= common.cost,
								requirements: this.requirements(common.cost),
							}
						: { ...common, kind };
		}
		this.current = page;
		this.submitted = false;
		this.pending = undefined;
		return page;
	}
	refresh(page: DialoguePage): DialoguePage | undefined {
		if (
			this.current !== page ||
			(page.kind !== "remote" &&
				page.kind !== "shared" &&
				(page.source !== this.source() ||
					("questID" in page && page.questID !== GetQuestID())))
		)
			return undefined;
		const submitted = this.submitted;
		const next = this.read(
			page.kind,
			page.kind === "offer" ? page.startItem : undefined,
			"questID" in page ? page.questID : undefined,
			page.kind === "shared" ? page.speaker : undefined,
			page.kind === "shared" ? page.title : undefined,
		);
		this.submitted = submitted;
		return next;
	}
	private item(kind: string, index: number): DialogueReward {
		const [name, icon, count] = GetQuestItemInfo(kind, index);
		return {
			id: `${kind}:${index}`,
			index,
			label: name ?? "Loading item…",
			icon,
			detail: `×${count ?? 1}`,
			tooltipLink: GetQuestItemLink(kind, index),
		};
	}
	private rewards(questID: number): {
		rewards: DialogueReward[];
		choices: DialogueReward[];
	} {
		const rewards: DialogueReward[] = [],
			choices: DialogueReward[] = [];
		for (let i = 1; i <= GetNumQuestRewards(); i++)
			rewards.push(this.item("reward", i));
		for (let i = 1; i <= GetNumQuestChoices(); i++) {
			if (GetQuestItemInfoLootType("choice", i) === 1) {
				const c = offerAPI().GetQuestRewardCurrencyInfo("choice", i);
				choices.push({
					id: `choice:${i}`,
					index: i,
					label: c?.name ?? "Loading currency…",
					icon: c?.texture,
					tooltipLink: c ? `currency:${c.currencyID}` : undefined,
					detail: `×${c?.totalRewardAmount ?? 0}`,
				});
			} else choices.push(this.item("choice", i));
		}
		for (const c of questInfoAPI().GetQuestRewardCurrencies(questID) ?? [])
			rewards.push({
				id: `currency:${c.currencyID}`,
				label: c.name,
				icon: c.texture,
				tooltipLink: `currency:${c.currencyID}`,
				detail: `×${c.totalRewardAmount}`,
			});
		for (const id of questInfoAPI().GetQuestRewardSpells(questID) ?? []) {
			const spell = questInfoAPI().GetQuestRewardSpellInfo(questID, id);
			rewards.push({
				id: `spell:${id}`,
				label: spell?.name ?? "Loading spell…",
				icon: spell?.texture,
				tooltipLink: `spell:${id}`,
				detail: "Spell reward",
			});
		}
		for (const [id, value, label] of [
			["money", GetRewardMoney(), "Money"],
			["xp", GetRewardXP(), "XP"],
			["honor", GetRewardHonor(), "Honor"],
		] as const)
			if (value > 0)
				rewards.push({
					id,
					label: id === "money" ? dialogueMoney(value) : `${value} ${label}`,
				});
		const title = GetRewardTitle();
		if (title)
			rewards.push({ id: "title", label: title, detail: "Title reward" });
		const [skill, icon, points] = GetRewardSkillPoints();
		if (skill && points > 0)
			rewards.push({ id: "skill", label: `${skill}: +${points}`, icon });
		const [artifact] = GetRewardArtifactXP();
		if (artifact > 0)
			rewards.push({ id: "artifact", label: `${artifact} Artifact XP` });
		const factionAPI = C_Reputation as unknown as {
			GetFactionDataByID(this: void, id: number): { name: string } | undefined;
		};
		for (const rep of offerAPI().GetQuestOfferMajorFactionReputationRewards() ??
			[])
			rewards.push({
				id: `rep:${rep.factionID}`,
				label: `${factionAPI.GetFactionDataByID(rep.factionID)?.name ?? "Reputation"}: +${rep.rewardAmount}`,
				detail: "Reputation",
			});
		return { rewards, choices };
	}
	private requirements(cost: number): DialogueEntry[] {
		const entries: DialogueEntry[] = [];
		for (let i = 1; i <= GetNumQuestItems(); i++) {
			const [name, icon, required, , , itemID] = GetQuestItemInfo(
				"required",
				i,
			);
			const owned = itemID
				? C_Item.GetItemCount(itemID, false, false, false, false)
				: undefined;
			entries.push({
				id: `required:${i}`,
				label: name ?? "Loading item…",
				icon,
				detail:
					owned === undefined
						? `Required: ${required}`
						: `${owned}/${required}${owned < required ? " · Incomplete" : " · Complete"}`,
			});
		}
		for (let i = 1; i <= GetNumQuestCurrencies(); i++) {
			const c = offerAPI().GetQuestRequiredCurrencyInfo(i);
			const currency = C_CurrencyInfo as unknown as {
				GetCurrencyInfo(
					this: void,
					id: number,
				): { quantity: number } | undefined;
			};
			const owned = c
				? currency.GetCurrencyInfo(c.currencyID)?.quantity
				: undefined;
			entries.push({
				id: `required-currency:${i}`,
				label: c?.name ?? "Loading currency…",
				icon: c?.texture,
				detail:
					owned === undefined
						? `Required: ${c?.requiredAmount ?? 0}`
						: `${owned}/${c?.requiredAmount ?? 0}${owned < (c?.requiredAmount ?? 0) ? " · Incomplete" : " · Complete"}`,
			});
		}
		if (cost > 0)
			entries.push({
				id: "required-money",
				label: `Cost: ${dialogueMoney(cost)}`,
				detail: GetMoney() < cost ? "Not enough money" : "Available",
			});
		return entries;
	}
	private valid(page: DialoguePage): boolean {
		return (
			!this.isInCombat() &&
			!this.submitted &&
			this.current === page &&
			(page.kind === "remote" ||
				page.kind === "shared" ||
				(page.source === this.source() &&
					(!("questID" in page) || page.questID === GetQuestID())))
		);
	}
	private commit(page: DialoguePage, action: () => void): DialogueResult {
		if (!this.valid(page))
			return {
				ok: false,
				reason: this.isInCombat()
					? "Dialogue paused during combat."
					: "The conversation changed. Please try again.",
			};
		// Set before invoking an API: its event can synchronously replace this snapshot.
		this.submitted = true;
		action();
		return { ok: true };
	}
	select(page: DialoguePage, entryID: string): DialogueResult {
		if (page.kind !== "gossip" && page.kind !== "greeting")
			return { ok: false, reason: "No choices on this page." };
		const entry = page.entries.find((e) => e.id === entryID);
		if (!entry || entry.disabled)
			return { ok: false, reason: entry?.detail ?? "Unavailable choice." };
		const [kind, idText] = entryID.split(":");
		const id = Number(idText);
		const present =
			kind === "available"
				? gossipAPI()
						.GetAvailableQuests()
						.some(
							(q) =>
								q.questID === id && !C_QuestLog.IsQuestDisabledForSession(id),
						)
				: kind === "active"
					? gossipAPI()
							.GetActiveQuests()
							.some((q) => q.questID === id)
					: kind === "option" || kind === "index"
						? gossipAPI()
								.GetOptions()
								.some(
									(o) =>
										(kind === "option"
											? o.gossipOptionID === id
											: o.gossipOptionID === undefined &&
												o.orderIndex === id) &&
										o.status !== 1 &&
										o.status !== 2,
								)
						: kind === "greeting-available"
							? id <= GetNumAvailableQuests() &&
								GetAvailableTitle(id) === entry.label
							: kind === "greeting-active"
								? id <= GetNumActiveQuests() &&
									this.activeTitle(id) === entry.label
								: false;
		if (!present)
			return { ok: false, reason: "This choice is no longer available." };
		return this.commit(page, () => {
			if (kind === "available") C_GossipInfo.SelectAvailableQuest(id);
			else if (kind === "active") C_GossipInfo.SelectActiveQuest(id);
			else if (kind === "option") C_GossipInfo.SelectOption(id);
			else if (kind === "index") C_GossipInfo.SelectOptionByIndex(id);
			else if (kind === "greeting-available") SelectAvailableQuest(id);
			else if (kind === "greeting-active") SelectActiveQuest(id);
		});
	}
	private activeTitle(index: number): string {
		const [title] = GetActiveTitle(index);
		return title;
	}
	accept(page: DialoguePage, confirmed = false): DialogueResult {
		if (page.kind === "shared") {
			const [, count] = C_QuestLog.GetNumQuestLogEntries();
			if (!page.eligible || count >= C_QuestLog.GetMaxNumQuestsCanAccept())
				return { ok: false, reason: "Quest log is full." };
			return this.commit(page, () => ConfirmAcceptQuest());
		}
		if (page.kind !== "offer") return { ok: false };
		if (page.pvp && !page.autoAccepted && !confirmed)
			return {
				ok: false,
				reason:
					"Accepting this quest will flag you for PvP. Confirm to accept.",
			};
		return this.commit(page, () => {
			if (page.autoAccepted) AcknowledgeAutoAcceptQuest();
			else AcceptQuest();
		});
	}
	advance(page: DialoguePage): DialogueResult {
		if (page.kind === "remote") {
			if (!C_QuestLog.IsComplete(page.questID))
				return { ok: false, reason: "This quest is no longer complete." };
			return this.commit(page, () => ShowQuestComplete(page.questID));
		}
		if (
			page.kind !== "progress" ||
			!IsQuestCompletable() ||
			GetMoney() < GetQuestMoneyToGet()
		)
			return { ok: false, reason: "Quest requirements are not met." };
		return this.commit(page, () => CompleteQuest());
	}
	claim(page: DialoguePage, index?: number, confirmed = false): DialogueResult {
		if (page.kind !== "rewards") return { ok: false };
		const count = GetNumQuestChoices();
		const selection = index ?? (count === 1 ? 1 : 0);
		if (count !== page.choices.length)
			return {
				ok: false,
				reason: "Reward choices changed. Review them again.",
			};
		if (
			count > 0 &&
			(!page.choices.some((c) => c.index === selection) ||
				selection < 1 ||
				selection > count)
		)
			return { ok: false, reason: "Select a reward first." };
		const cost = GetQuestMoneyToGet();
		if (cost !== page.cost)
			return { ok: false, reason: "Quest cost changed. Review it again." };
		if (GetMoney() < cost) return { ok: false, reason: "Not enough money." };
		if (cost > 0 && !confirmed)
			return { ok: false, reason: `Complete for ${dialogueMoney(cost)}?` };
		return this.commit(page, () => GetQuestReward(count === 0 ? 0 : selection));
	}
	prompt(page: DialoguePage, prompt: DialoguePrompt): void {
		if (this.current !== page) return;
		this.submitted = false;
		this.pending = { page, prompt };
	}
	confirm(page: DialoguePage, code = ""): DialogueResult {
		const pending = this.pending;
		if (!pending || pending.page !== page)
			return { ok: false, reason: "Confirmation expired." };
		if (pending.prompt.cost > GetMoney())
			return { ok: false, reason: "Not enough money." };
		this.pending = undefined;
		return this.commit(page, () =>
			C_GossipInfo.SelectOption(pending.prompt.optionID, code, true),
		);
	}
	cancelPrompt(): void {
		this.pending = undefined;
		this.submitted = false;
	}
	close(page: DialoguePage): void {
		if (this.current !== page || this.isInCombat()) return;
		this.end();
		if (page.kind === "gossip") C_GossipInfo.CloseGossip();
		else if (page.kind !== "remote") {
			if (page.kind === "offer" && page.autoAccepted)
				AcknowledgeAutoAcceptQuest();
			else DeclineQuest();
			CloseQuest();
		}
	}
	end(): void {
		this.current = undefined;
		this.pending = undefined;
		this.submitted = true;
		this.session++;
	}
}
