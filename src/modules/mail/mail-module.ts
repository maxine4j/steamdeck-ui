import type { IMailClient } from "../../clients/mail-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { ApplicationEvent, IEventBus } from "../../events/types";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { IModule } from "../types";

export interface MailView {
	refresh(): void;
	reset(): void;
	sent(): void;
	failed(): void;
	cancel(): void;
}
export class MailModule implements IModule {
	readonly id = "mail";
	private open = false;
	private cancelRefresh?: () => void;
	constructor(
		private readonly ui: Pick<IUIOrchestrator, "openPanel" | "closePanel">,
		private readonly events: IEventBus,
		private readonly client: IMailClient,
		private readonly view: MailView,
		private readonly scheduler: ITaskScheduler,
	) {}
	disableBuiltIn(): void {
		this.client.disableBuiltIn();
	}
	private readonly show = () => {
		this.open = true;
		this.client.setOpen(true);
		this.client.disableBuiltIn();
		this.view.reset();
		this.view.refresh();
		this.ui.openPanel("bags", "right");
		this.ui.openPanel("mail-inbox", "left", "mail");
		this.client.checkInbox();
	};
	private readonly closed = () => {
		if (!this.open) return;
		this.open = false;
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.view.cancel();
		this.client.setOpen(false);
		this.ui.closePanel("left", undefined, "mail");
	};
	private readonly refresh = () => {
		if (!this.open || this.cancelRefresh) return;
		this.cancelRefresh = this.scheduler.nextFrame(() => {
			this.cancelRefresh = undefined;
			if (this.open) {
				this.client.disableBuiltIn();
				this.view.refresh();
			}
		});
	};
	private readonly inboxChanged = () => {
		this.client.invalidateInbox();
		this.refresh();
	};
	private readonly sent = () => {
		if (!this.open) return;
		this.client.completeSend(true);
		this.view.sent();
		this.refresh();
	};
	private readonly failed = () => {
		if (!this.open) return;
		this.client.completeSend(false);
		this.view.failed();
		this.refresh();
	};
	private readonly lock = () => {
		this.client.setLocked(true);
		this.refresh();
	};
	private readonly unlock = () => {
		this.client.setLocked(false);
		this.refresh();
	};
	initialize(): void {
		this.events.subscribe("MAIL_INBOX_UPDATE", this.inboxChanged);
		this.events.subscribe("MAIL_SHOW", this.show);
		this.events.subscribe("MAIL_CLOSED", this.closed);
		this.events.subscribe("MAIL_SEND_SUCCESS", this.sent);
		this.events.subscribe("MAIL_FAILED", this.failed);
		this.events.subscribe("MAIL_LOCK_SEND_ITEMS", this.lock);
		this.events.subscribe("MAIL_UNLOCK_SEND_ITEMS", this.unlock);
		for (const event of updates) this.events.subscribe(event, this.refresh);
	}
	shutdown(): void {
		this.events.unsubscribe("MAIL_INBOX_UPDATE", this.inboxChanged);
		this.events.unsubscribe("MAIL_SHOW", this.show);
		this.events.unsubscribe("MAIL_CLOSED", this.closed);
		this.events.unsubscribe("MAIL_SEND_SUCCESS", this.sent);
		this.events.unsubscribe("MAIL_FAILED", this.failed);
		this.events.unsubscribe("MAIL_LOCK_SEND_ITEMS", this.lock);
		this.events.unsubscribe("MAIL_UNLOCK_SEND_ITEMS", this.unlock);
		for (const event of updates) this.events.unsubscribe(event, this.refresh);
		if (this.open) {
			this.client.close();
			this.closed();
		}
		this.client.restoreBuiltIn();
	}
}
const updates: readonly ApplicationEvent[] = [
	"MAIL_SEND_INFO_UPDATE",
	"MAIL_SUCCESS",
	"CLOSE_INBOX_ITEM",
	"PLAYER_MONEY",
	"DIALOGUE_ADDON_LOADED",
];
