export type ApplicationEvent =
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
