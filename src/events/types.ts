export type ApplicationEvent =
	| "PLAYER_LOGIN"
	| "BAG_UPDATE_DELAYED"
	| "BAG_VISIBILITY_CHANGED"
	| "BAG_OPEN"
	| "BAG_CLOSED";
export type EventHandler = () => void;
export interface IEventBus {
	emit(event: ApplicationEvent): void;
	subscribe(event: ApplicationEvent, handler: EventHandler): void;
	unsubscribe(event: ApplicationEvent, handler: EventHandler): void;
}
