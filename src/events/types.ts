export type ApplicationEvent = "PLAYER_LOGIN";
export type EventHandler = () => void;
export interface IEventBus {
	subscribe(event: ApplicationEvent, handler: EventHandler): void;
	unsubscribe(event: ApplicationEvent, handler: EventHandler): void;
}
