import type { WowEventFrame } from "../types";
import type {
	ApplicationEvent,
	EventHandler,
	EventPayload,
	IEventBus,
} from "./types";

const petEvents = [
	"PET_JOURNAL_LIST_UPDATE",
	"NEW_PET_ADDED",
	"PET_JOURNAL_PET_DELETED",
	"PET_JOURNAL_PET_REVOKED",
	"PET_JOURNAL_PET_RESTORED",
];
const dialogueEvents = [
	"GOSSIP_SHOW",
	"GOSSIP_OPTIONS_REFRESHED",
	"GOSSIP_CLOSED",
	"GOSSIP_CONFIRM",
	"GOSSIP_CONFIRM_CANCEL",
	"GOSSIP_ENTER_CODE",
	"QUEST_GREETING",
	"QUEST_DETAIL",
	"QUEST_PROGRESS",
	"QUEST_COMPLETE",
	"QUEST_FINISHED",
	"QUEST_ITEM_UPDATE",
	"QUEST_LOG_UPDATE",
	"QUEST_AUTOCOMPLETE",
	"QUEST_ACCEPT_CONFIRM",
	"PLAYER_ENTERING_WORLD",
	"PLAYER_LOGOUT",
	"ADDON_LOADED",
	"PLAYER_INTERACTION_MANAGER_FRAME_SHOW",
	"UI_ERROR_MESSAGE",
];
const vendorEvents = [
	"MERCHANT_SHOW",
	"MERCHANT_CLOSED",
	"MERCHANT_UPDATE",
	"MERCHANT_FILTER_ITEM_UPDATE",
	"GUILDBANK_UPDATE_MONEY",
	"GUILDBANK_UPDATE_WITHDRAWMONEY",
] as const;
const bankEvents = [
	"BANKFRAME_OPENED",
	"BANKFRAME_CLOSED",
	"BANK_TABS_CHANGED",
	"ACCOUNT_MONEY",
] as const;
const mailEvents = [
	"MAIL_SHOW",
	"MAIL_CLOSED",
	"MAIL_INBOX_UPDATE",
	"MAIL_SEND_INFO_UPDATE",
	"MAIL_SEND_SUCCESS",
	"MAIL_FAILED",
	"MAIL_SUCCESS",
	"MAIL_LOCK_SEND_ITEMS",
	"MAIL_UNLOCK_SEND_ITEMS",
	"CLOSE_INBOX_ITEM",
] as const;
const bankContentEvents = [
	"BAG_UPDATE",
	"PLAYERBANKSLOTS_CHANGED",
	"PLAYER_ACCOUNT_BANK_TAB_SLOTS_CHANGED",
	"ITEM_LOCK_CHANGED",
];
export interface EventFrameFactory {
	createEventFrame(): WowEventFrame;
}
const characterStatEvents = [
	"COMBAT_RATING_UPDATE",
	"MASTERY_UPDATE",
	"SPEED_UPDATE",
	"LIFESTEAL_UPDATE",
	"AVOIDANCE_UPDATE",
	"PLAYER_AVG_ITEM_LEVEL_UPDATE",
	"PLAYER_TALENT_UPDATE",
	"ACTIVE_TALENT_GROUP_CHANGED",
	"SPELL_POWER_CHANGED",
	"PLAYER_ENTERING_WORLD",
];
const characterIdentityEvents = [
	"PLAYER_ENTERING_WORLD",
	"GUILD_ROSTER_UPDATE",
	"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
];
const characterIdentityUnitEvents = [
	"UNIT_NAME_UPDATE",
	"UNIT_LEVEL",
	"PLAYER_GUILD_UPDATE",
	"PLAYER_SPECIALIZATION_CHANGED",
];
const actionBarEvents = [
	"PET_BAR_UPDATE_COOLDOWN",
	"UPDATE_SHAPESHIFT_COOLDOWN",
	"SPELLS_CHANGED",
	"UPDATE_EXTRA_ACTIONBAR",
	"ZONE_CHANGED_NEW_AREA",
	"ACTIONBAR_SLOT_CHANGED",
	"ACTIONBAR_UPDATE_COOLDOWN",
	"SPELL_UPDATE_COOLDOWN",
	"SPELL_UPDATE_CHARGES",
	"UPDATE_MACROS",
	"PLAYER_ENTERING_WORLD",
];
const actionRingEvents = [
	"PET_BAR_UPDATE",
	"PET_SPECIALIZATION_CHANGED",
	"UPDATE_SHAPESHIFT_FORMS",
	"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
	"QUEST_LOG_UPDATE",
	"QUEST_WATCH_LIST_CHANGED",
	"QUEST_ITEM_UPDATE",
	"BAG_UPDATE_DELAYED",
	"ITEM_DATA_LOAD_RESULT",
	"SPELLS_CHANGED",
	"ZONE_CHANGED_NEW_AREA",
	"UPDATE_EXTRA_ACTIONBAR",
	"PLAYER_ENTERING_WORLD",
];
const actionCursorEvents = [
	"CURSOR_CHANGED",
	"ACTIONBAR_SHOWGRID",
	"ACTIONBAR_HIDEGRID",
];
const characterUnitEvents = [
	"UNIT_STATS",
	"UNIT_MAXHEALTH",
	"UNIT_AURA",
	"UNIT_DAMAGE",
	"UNIT_ATTACK_SPEED",
	"UNIT_LEVEL",
];
const reputationEvents = [
	"UPDATE_FACTION",
	"MAJOR_FACTION_RENOWN_LEVEL_CHANGED",
	"MAJOR_FACTION_UNLOCKED",
	"QUEST_LOG_UPDATE",
];
const titleEvents = ["KNOWN_TITLES_UPDATE", "UNIT_NAME_UPDATE"];
const achievementEvents = [
	"ACHIEVEMENT_EARNED",
	"CRITERIA_UPDATE",
	"RECEIVED_ACHIEVEMENT_LIST",
	"PLAYER_ENTERING_WORLD",
];
const currencyEvents = [
	"CURRENCY_DISPLAY_UPDATE",
	"ACCOUNT_CHARACTER_CURRENCY_DATA_RECEIVED",
	"CURRENCY_TRANSFER_INITIATED",
	"CURRENCY_TRANSFER_SUCCESS",
	"CURRENCY_TRANSFER_FAILED",
	"PLAYER_ENTERING_WORLD",
];
const dungeonFinderEvents = [
	"LFG_UPDATE_RANDOM_INFO",
	"LFG_UPDATE",
	"LFG_ROLE_UPDATE",
	"LFG_LOCK_INFO_RECEIVED",
	"LFG_COOLDOWNS_UPDATED",
	"UPDATE_BATTLEFIELD_STATUS",
	"PVP_ROLE_UPDATE",
	"PVP_TYPES_ENABLED",
	"PVP_RATED_STATS_UPDATE",
	"PVP_REWARDS_UPDATE",
	"PVP_BRAWL_INFO_UPDATED",
	"PLAYER_AVG_ITEM_LEVEL_UPDATE",
	"GET_ITEM_INFO_RECEIVED",
	"PVPQUEUE_ANYWHERE_UPDATE_AVAILABLE",
	"PLAYER_LEVEL_UP",
	"PLAYER_SPECIALIZATION_CHANGED",
	"LFG_LIST_ACTIVE_ENTRY_UPDATE",
	"LFG_LIST_SEARCH_RESULT_UPDATED",
	"GROUP_ROSTER_UPDATE",
	"PLAYER_ENTERING_WORLD",
];
const talentEvents = [
	"PLAYER_TALENT_UPDATE",
	"ACTIVE_TALENT_GROUP_CHANGED",
	"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
	"SELECTED_LOADOUT_CHANGED",
	"TRAIT_CONFIG_CREATED",
	"TRAIT_CONFIG_UPDATED",
	"TRAIT_CONFIG_DELETED",
	"TRAIT_CONFIG_LIST_UPDATED",
	"ACTIVE_COMBAT_CONFIG_CHANGED",
	"CONFIG_COMMIT_FAILED",
	"STARTER_BUILD_ACTIVATION_FAILED",
	"PLAYER_ENTERING_WORLD",
];
const mountEvents = [
	"COMPANION_LEARNED",
	"COMPANION_UNLEARNED",
	"NEW_MOUNT_ADDED",
];
/** Owns the hidden event frame; modules only see IEventBus. */
export class WowEventBus implements IEventBus {
	private readonly handlers = new Map<ApplicationEvent, EventHandler[]>();

	subscribe<E extends ApplicationEvent>(
		event: E,
		handler: EventHandler<E>,
	): void {
		const handlers = this.handlers.get(event) ?? [];
		const erased = handler as EventHandler;
		if (!handlers.includes(erased)) handlers.push(erased);
		this.handlers.set(event, handlers);
	}
	unsubscribe<E extends ApplicationEvent>(
		event: E,
		handler: EventHandler<E>,
	): void {
		this.handlers.set(
			event,
			(this.handlers.get(event) ?? []).filter(
				(candidate) => candidate !== handler,
			),
		);
	}
	emit<E extends ApplicationEvent>(
		event: E,
		...args: undefined extends EventPayload<E>
			? [payload?: EventPayload<E>]
			: [EventPayload<E>]
	): void {
		for (const handler of [...(this.handlers.get(event) ?? [])])
			handler(args.at(0));
	}

	private readonly frame: WowEventFrame;
	constructor(factory: EventFrameFactory) {
		this.frame = factory.createEventFrame();
		this.frame.Hide();
		for (const event of dialogueEvents) this.frame.RegisterEvent(event);
		for (const event of bankEvents) this.frame.RegisterEvent(event);
		for (const event of mailEvents) this.frame.RegisterEvent(event);
		for (const event of bankContentEvents) this.frame.RegisterEvent(event);
		this.frame.RegisterEvent("PLAYER_LOGIN");
		this.frame.RegisterEvent("TOYS_UPDATED");
		for (const event of petEvents) this.frame.RegisterEvent(event);
		this.frame.RegisterEvent("PLAYER_REGEN_DISABLED");
		this.frame.RegisterEvent("BAG_UPDATE_DELAYED");
		this.frame.RegisterEvent("BAG_UPDATE_COOLDOWN");
		this.frame.RegisterEvent("BAG_OPEN");
		this.frame.RegisterEvent("BAG_CLOSED");
		this.frame.RegisterEvent("PLAYER_MONEY");
		this.frame.RegisterEvent("ITEM_DATA_LOAD_RESULT");
		this.frame.RegisterEvent("PLAYER_EQUIPMENT_CHANGED");
		this.frame.RegisterEvent("UNIT_MODEL_CHANGED");
		this.frame.RegisterEvent("UNIT_PORTRAIT_UPDATE");
		this.frame.RegisterEvent("PORTRAITS_UPDATED");
		for (const event of actionBarEvents) this.frame.RegisterEvent(event);
		for (const event of actionRingEvents) this.frame.RegisterEvent(event);
		this.frame.RegisterEvent("UNIT_PET");
		for (const event of actionCursorEvents) this.frame.RegisterEvent(event);
		for (const event of [
			...characterStatEvents,
			...characterUnitEvents,
			...characterIdentityEvents,
			...characterIdentityUnitEvents,
			...reputationEvents,
			...currencyEvents,
			...titleEvents,
			...achievementEvents,
			...dungeonFinderEvents,
			...mountEvents,
			"MOUNT_JOURNAL_SEARCH_UPDATED",
			"MOUNT_EQUIPMENT_APPLY_RESULT",
			...talentEvents,
			...vendorEvents,
			"PLAYER_SPECIALIZATION_CHANGED",
		])
			this.frame.RegisterEvent(event);
		this.frame.SetScript("OnEvent", (_frame, event, ...args) => {
			if ((mailEvents as readonly string[]).includes(event))
				this.emit(event as (typeof mailEvents)[number]);
			if (bankContentEvents.includes(event)) this.emit("BANK_CONTENTS_CHANGED");
			if ((bankEvents as readonly string[]).includes(event))
				this.emit(event as (typeof bankEvents)[number]);
			if ((vendorEvents as readonly string[]).includes(event))
				this.emit(event as (typeof vendorEvents)[number]);
			const unit = args.at(0);
			if (
				event === "PLAYER_INTERACTION_MANAGER_FRAME_SHOW" &&
				typeof unit === "number"
			)
				this.emit("DIALOGUE_INTERACTION_SHOWN", { interactionType: unit });
			if (event === "UI_ERROR_MESSAGE" && typeof args.at(1) === "string")
				this.emit("DIALOGUE_ERROR", { message: args.at(1) as string });
			if (event === "GOSSIP_CLOSED")
				this.emit(event, { continuing: unit === true });
			else if (
				event === "GOSSIP_CONFIRM" &&
				typeof unit === "number" &&
				typeof args.at(1) === "string"
			)
				this.emit(event, {
					optionID: unit,
					text: args.at(1) as string,
					cost: typeof args.at(2) === "number" ? (args.at(2) as number) : 0,
				});
			else if (event === "GOSSIP_ENTER_CODE" && typeof unit === "number")
				this.emit(event, { optionID: unit });
			else if (event === "QUEST_DETAIL")
				this.emit(event, {
					startItem: typeof unit === "number" ? unit : undefined,
				});
			else if (event === "QUEST_AUTOCOMPLETE" && typeof unit === "number")
				this.emit(event, { questID: unit });
			else if (event === "QUEST_ACCEPT_CONFIRM" && typeof unit === "string")
				this.emit(event, {
					speaker: unit,
					title: args.at(1) as string,
					questID: args.at(2) as number,
				});
			else if (event === "PLAYER_ENTERING_WORLD" || event === "PLAYER_LOGOUT")
				this.emit("DIALOGUE_WORLD_RESET");
			else if (event === "ADDON_LOADED") this.emit("DIALOGUE_ADDON_LOADED");
			else if (
				[
					"GOSSIP_SHOW",
					"GOSSIP_OPTIONS_REFRESHED",
					"GOSSIP_CONFIRM_CANCEL",
					"QUEST_GREETING",
					"QUEST_PROGRESS",
					"QUEST_COMPLETE",
					"QUEST_FINISHED",
					"QUEST_ITEM_UPDATE",
					"QUEST_LOG_UPDATE",
				].includes(event)
			)
				this.emit(event as "GOSSIP_SHOW");
			if (
				characterIdentityEvents.includes(event) ||
				(characterIdentityUnitEvents.includes(event) && unit === "player")
			)
				this.emit("CHARACTER_IDENTITY_CHANGED");
			if (event === "PLAYER_REGEN_DISABLED") this.emit("COMBAT_STARTED");
			if (
				actionBarEvents.includes(event) ||
				(event === "UNIT_AURA" && unit === "player")
			)
				this.emit("ACTION_BAR_CHANGED");
			if (actionCursorEvents.includes(event))
				this.emit("ACTION_BAR_CURSOR_CHANGED");
			if (
				actionRingEvents.includes(event) ||
				(event === "UNIT_PET" && unit === "player") ||
				(event === "PLAYER_SPECIALIZATION_CHANGED" && unit === "player")
			)
				this.emit("ACTION_RING_CONTENTS_CHANGED");
			if (event === "PLAYER_REGEN_ENABLED") this.emit("COMBAT_ENDED");
			if (
				talentEvents.includes(event) ||
				(event === "PLAYER_SPECIALIZATION_CHANGED" && unit === "player")
			)
				this.emit("TALENTS_CHANGED");
			if (mountEvents.includes(event))
				this.emit(
					"MOUNTS_CHANGED",
					event === "NEW_MOUNT_ADDED" && typeof unit === "number"
						? { id: unit }
						: undefined,
				);
			if (petEvents.includes(event)) this.emit("PETS_CHANGED");
			if (event === "MOUNT_JOURNAL_SEARCH_UPDATED")
				this.emit("MOUNTS_SEARCH_CHANGED");
			if (event === "MOUNT_EQUIPMENT_APPLY_RESULT")
				this.emit("MOUNTS_EQUIPMENT_CHANGED");
			if (achievementEvents.includes(event))
				this.emit(
					"ACHIEVEMENTS_CHANGED",
					event === "ACHIEVEMENT_EARNED" && typeof unit === "number"
						? { id: unit }
						: undefined,
				);
			if (event === "TOYS_UPDATED")
				this.emit(
					"TOYS_CHANGED",
					typeof unit === "number" ? { id: unit } : undefined,
				);
			if (event === "ITEM_DATA_LOAD_RESULT")
				this.emit(
					"ITEM_DATA_LOAD_RESULT",
					typeof unit === "number"
						? { id: unit, success: args.at(1) === true }
						: undefined,
				);
			if (event === "SPELL_UPDATE_COOLDOWN") this.emit("TOYS_COOLDOWN_CHANGED");
			if (event === "BAG_UPDATE_COOLDOWN" || event === "SPELL_UPDATE_COOLDOWN")
				this.emit("BAG_COOLDOWNS_CHANGED");
			if (dungeonFinderEvents.includes(event))
				this.emit("DUNGEON_FINDER_CHANGED");
			if (reputationEvents.includes(event)) this.emit("REPUTATION_CHANGED");
			if (currencyEvents.includes(event)) this.emit("CURRENCY_CHANGED");
			if (event === "CURRENCY_TRANSFER_SUCCESS")
				this.emit("CURRENCY_TRANSFER_SUCCEEDED");
			if (event === "CURRENCY_TRANSFER_FAILED")
				this.emit("CURRENCY_TRANSFER_REJECTED");
			if (
				event === "KNOWN_TITLES_UPDATE" ||
				(event === "UNIT_NAME_UPDATE" && unit === "player")
			)
				this.emit("TITLES_CHANGED");
			if (event === "PLAYER_EQUIPMENT_CHANGED")
				this.emit("PLAYER_EQUIPMENT_CHANGED");
			else if (
				event === "PORTRAITS_UPDATED" ||
				((event === "UNIT_MODEL_CHANGED" || event === "UNIT_PORTRAIT_UPDATE") &&
					unit === "player")
			)
				this.emit("CHARACTER_MODEL_CHANGED");
			else if (
				characterStatEvents.includes(event) ||
				(characterUnitEvents.includes(event) && unit === "player")
			)
				this.emit("CHARACTER_STATS_CHANGED");
			if (
				event === "PLAYER_LOGIN" ||
				event === "BAG_UPDATE_DELAYED" ||
				event === "BAG_OPEN" ||
				event === "BAG_CLOSED" ||
				event === "PLAYER_MONEY"
			)
				this.emit(event);
		});
	}
}
