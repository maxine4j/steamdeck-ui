export interface DialogueEventPayloads {
	GOSSIP_SHOW: undefined;
	GOSSIP_OPTIONS_REFRESHED: undefined;
	GOSSIP_CLOSED: { continuing: boolean };
	GOSSIP_CONFIRM: { optionID: number; text: string; cost: number };
	GOSSIP_CONFIRM_CANCEL: undefined;
	GOSSIP_ENTER_CODE: { optionID: number };
	QUEST_GREETING: undefined;
	QUEST_DETAIL: { startItem?: number };
	QUEST_PROGRESS: undefined;
	QUEST_COMPLETE: undefined;
	QUEST_FINISHED: undefined;
	QUEST_ITEM_UPDATE: undefined;
	QUEST_LOG_UPDATE: undefined;
	QUEST_AUTOCOMPLETE: { questID: number };
	QUEST_ACCEPT_CONFIRM: { speaker: string; title: string; questID: number };
	DIALOGUE_WORLD_RESET: undefined;
	DIALOGUE_ADDON_LOADED: undefined;
	DIALOGUE_INTERACTION_SHOWN: { interactionType: number };
	DIALOGUE_ERROR: { message: string };
}
interface ApplicationEventPayloads extends DialogueEventPayloads {
	HEIRLOOMS_CHANGED: { id?: number } | undefined;
	APPEARANCES_CHANGED: { sourceId?: number; appearanceId?: number } | undefined;
	AUCTION_HOUSE_CHANGED: import("../clients/auction-house-client").AuctionUpdate;
	NAV_DIRECTION_CHANGED: {
		direction: "up" | "down" | "left" | "right";
		pressed: boolean;
	};
	MAP_DETAILS_CHANGED: { id?: number };
	MAP_NAVIGATION_CHANGED: undefined;
	ACHIEVEMENTS_SELECTED: { id: number };
	ACHIEVEMENTS_CACHE_UPDATED: undefined;
	MOUNTS_CHANGED: { id?: number; source?: string } | undefined;
	TOYS_CHANGED: { id: number } | undefined;
	PETS_CHANGED: { id: string; removed?: boolean } | undefined;
	ACHIEVEMENTS_CHANGED: { id: number } | undefined;
	ITEM_DATA_LOAD_RESULT: { id: number; success: boolean } | undefined;
}
export type ApplicationEvent =
	| "LOOT_UPDATED"
	| "HEIRLOOMS_VISIBILITY_CHANGED"
	| "DEBUG_OPEN_REQUESTED"
	| "APPEARANCES_VISIBILITY_CHANGED"
	| "NATIVE_DIALOGS_CHANGED"
	| "AUCTION_HOUSE_SHOW"
	| "AUCTION_HOUSE_CLOSED"
	| "AUCTION_SELL_ITEM_SELECTED"
	| "INVENTORY_ITEM_USE_TARGET_CHANGED"
	| "MAIL_SHOW"
	| "MAIL_CLOSED"
	| "MAIL_INBOX_UPDATE"
	| "MAIL_SEND_INFO_UPDATE"
	| "MAIL_SEND_SUCCESS"
	| "MAIL_FAILED"
	| "MAIL_SUCCESS"
	| "MAIL_LOCK_SEND_ITEMS"
	| "MAIL_UNLOCK_SEND_ITEMS"
	| "CLOSE_INBOX_ITEM"
	| "BANKFRAME_OPENED"
	| "BANK_CONTENTS_CHANGED"
	| "BANKFRAME_CLOSED"
	| "BANK_TABS_CHANGED"
	| "ACCOUNT_MONEY"
	| keyof ApplicationEventPayloads
	| "NAV_UP"
	| "NAV_DOWN"
	| "NAV_LEFT"
	| "NAV_RIGHT"
	| "NAV_PANEL_PREVIOUS"
	| "NAV_PANEL_NEXT"
	| "NAV_CONTAINER_LEFT"
	| "NAV_CONTAINER_RIGHT"
	| "NAV_INTERACT"
	| "NAV_CONTEXT"
	| "NAV_ALTERNATE"
	| "NAV_CANCEL"
	| "COMBAT_STARTED"
	| "ACTION_BAR_CHANGED"
	| "ACTION_RING_CONTENTS_CHANGED"
	| "ACTION_BAR_CURSOR_CHANGED"
	| "COMBAT_ENDED"
	| "PLAYER_LOGIN"
	| "MERCHANT_SHOW"
	| "MERCHANT_CLOSED"
	| "MERCHANT_UPDATE"
	| "MERCHANT_FILTER_ITEM_UPDATE"
	| "GUILDBANK_UPDATE_MONEY"
	| "GUILDBANK_UPDATE_WITHDRAWMONEY"
	| "BAG_UPDATE_DELAYED"
	| "BAG_COOLDOWNS_CHANGED"
	| "PLAYER_MONEY"
	| "ITEM_DATA_LOAD_RESULT"
	| "BAG_VISIBILITY_CHANGED"
	| "BAG_OPEN"
	| "BAG_CLOSED"
	| "CHARACTER_VISIBILITY_CHANGED"
	| "CHARACTER_STATS_CHANGED"
	| "CHARACTER_IDENTITY_CHANGED"
	| "CHARACTER_MODEL_CHANGED"
	| "REPUTATION_CHANGED"
	| "CURRENCY_CHANGED"
	| "CURRENCY_VISIBILITY_CHANGED"
	| "CURRENCY_TRANSFER_SUCCEEDED"
	| "CURRENCY_TRANSFER_REJECTED"
	| "REPUTATION_VISIBILITY_CHANGED"
	| "TITLES_CHANGED"
	| "TITLES_OPEN"
	| "ACHIEVEMENTS_CHANGED"
	| "ACHIEVEMENTS_VISIBILITY_CHANGED"
	| "DUNGEON_FINDER_CHANGED"
	| "DUNGEON_FINDER_VISIBILITY_CHANGED"
	| "TALENTS_CHANGED"
	| "SPELLBOOK_CHANGED"
	| "SPELLBOOK_VISIBILITY_CHANGED"
	| "TALENTS_VISIBILITY_CHANGED"
	| "TRADING_POST_CHANGED"
	| "TRADING_POST_VISIBILITY_CHANGED"
	| "TRANSMOG_CHANGED"
	| "TRANSMOG_VISIBILITY_CHANGED"
	| "MAP_VISIBILITY_CHANGED"
	| "MOUNTS_CHANGED"
	| "MOUNTS_SEARCH_CHANGED"
	| "MOUNTS_EQUIPMENT_CHANGED"
	| "TOYS_CHANGED"
	| "TOYS_COOLDOWN_CHANGED"
	| "TOYS_VISIBILITY_CHANGED"
	| "PETS_VISIBILITY_CHANGED"
	| "MOUNTS_VISIBILITY_CHANGED"
	| "PLAYER_EQUIPMENT_CHANGED";
export type EventPayload<E extends ApplicationEvent> =
	E extends keyof ApplicationEventPayloads
		? ApplicationEventPayloads[E]
		: undefined;
export type EventHandler<E extends ApplicationEvent = ApplicationEvent> = (
	payload: EventPayload<E>,
) => void;
export interface IEventBus {
	emit<E extends ApplicationEvent>(
		event: E,
		...args: undefined extends EventPayload<E>
			? [payload?: EventPayload<E>]
			: [EventPayload<E>]
	): void;
	subscribe<E extends ApplicationEvent>(
		event: E,
		handler: EventHandler<E>,
	): void;
	unsubscribe<E extends ApplicationEvent>(
		event: E,
		handler: EventHandler<E>,
	): void;
}
