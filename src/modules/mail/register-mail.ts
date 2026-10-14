import type { IMailClient } from "../../clients/mail-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import { type IModalNavigation, Modal } from "../../ui/components/modal";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { MailModule } from "./mail-module";
import { MailInboxPanel, MailSendPanel } from "./mail-panel";

export function registerMail(
	pool: IFramePoolManager,
	navigation: IModalNavigation,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: Pick<ModuleManager, "register">,
	mail: IMailClient,
	scheduler: ITaskScheduler,
) {
	const modal = new Modal("mail-confirmation", pool, navigation, events);
	const send = new MailSendPanel(pool, mail, modal);
	const inbox = new MailInboxPanel(pool, mail, modal, scheduler, (message) => {
		send.reply(message);
		ui.openPanel("mail-send", "left", "mail");
	});
	ui.registerPanel(inbox, "left", "mail");
	ui.registerPanel(send, "left", "mail");
	modules.register(
		new MailModule(
			ui,
			events,
			mail,
			{
				refresh: () => {
					inbox.refresh();
					send.refresh();
				},
				reset: () => {
					inbox.reset();
					send.reset();
				},
				sent: () => send.sent(),
				failed: () => {
					inbox.failed();
					send.failed();
				},
				cancel: () => {
					inbox.cancel();
					modal.close();
				},
			},
			scheduler,
		),
	);
	return {
		destroy(): void {
			inbox.destroy();
			send.destroy();
			modal.destroy();
		},
	};
}
