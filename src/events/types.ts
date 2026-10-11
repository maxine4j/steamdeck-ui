export interface IEventBus {
    subscribe<T>(eventName: string, handler: (payload: T) => void): void;
    unsubscribe(eventName: string, handler: Function): void;
}
