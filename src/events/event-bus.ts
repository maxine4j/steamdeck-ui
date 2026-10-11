import type { ApplicationEvent, EventHandler, IEventBus } from "./types";
export class EventBus implements IEventBus {
	private readonly handlers = new Map<ApplicationEvent, EventHandler[]>();
	subscribe(event: ApplicationEvent, handler: EventHandler): void {
		const handlers = this.handlers.get(event) ?? [];
		if (!handlers.includes(handler)) handlers.push(handler);
		this.handlers.set(event, handlers);
	}
	unsubscribe(event: ApplicationEvent, handler: EventHandler): void {
		this.handlers.set(
			event,
			(this.handlers.get(event) ?? []).filter(
				(candidate) => candidate !== handler,
			),
		);
	}
	emit(event: ApplicationEvent): void {
		for (const handler of [...(this.handlers.get(event) ?? [])]) handler();
	}
}
