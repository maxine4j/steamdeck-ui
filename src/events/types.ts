export type ApplicationEvent =
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
	| "ACTION_BAR_CURSOR_CHANGED"
	| "COMBAT_ENDED"
	| "PLAYER_LOGIN"
	| "BAG_UPDATE_DELAYED"
	| "PLAYER_MONEY"
	| "ITEM_DATA_LOAD_RESULT"
	| "BAG_VISIBILITY_CHANGED"
	| "BAG_OPEN"
	| "BAG_CLOSED"
	| "CHARACTER_VISIBILITY_CHANGED"
	| "CHARACTER_STATS_CHANGED"
	| "CHARACTER_MODEL_CHANGED"
	| "REPUTATION_CHANGED"
	| "REPUTATION_VISIBILITY_CHANGED"
	| "TITLES_CHANGED"
	| "TITLES_OPEN"
	| "MOUNTS_CHANGED"
	| "MOUNTS_VISIBILITY_CHANGED"
	| "PLAYER_EQUIPMENT_CHANGED";
export type EventHandler = () => void;
export interface IEventBus {
	emit(event: ApplicationEvent): void;
	subscribe(event: ApplicationEvent, handler: EventHandler): void;
	unsubscribe(event: ApplicationEvent, handler: EventHandler): void;
}
