import { expect, it, vi } from "vitest";
import type { IMailClient } from "../../clients/mail-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { MailModule } from "./mail-module";

it("opens separate left mail with bags, refreshes updates, clears only successful drafts and closes cleanly", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const client = {
		invalidateInbox: vi.fn(),
		disableBuiltIn: vi.fn(),
		restoreBuiltIn: vi.fn(),
		setOpen: vi.fn(),
		setLocked: vi.fn(),
		checkInbox: vi.fn(),
		completeSend: vi.fn(),
		close: vi.fn(),
	} as unknown as IMailClient;
	const view = {
		refresh: vi.fn(),
		reset: vi.fn(),
		sent: vi.fn(),
		failed: vi.fn(),
		cancel: vi.fn(),
	};
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	};
	const module = new MailModule(ui, events, client, view, scheduler);
	module.disableBuiltIn();
	module.initialize();
	events.emit("MAIL_SHOW");
	expect(ui.openPanel).toHaveBeenCalledWith("bags", "right");
	expect(ui.openPanel).toHaveBeenCalledWith("mail-inbox", "left", "mail");
	expect(view.reset).toHaveBeenCalledOnce();
	expect(client.checkInbox).toHaveBeenCalledOnce();
	events.emit("MAIL_INBOX_UPDATE");
	events.emit("MAIL_SEND_INFO_UPDATE");
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(view.refresh).toHaveBeenCalledTimes(2);
	expect(client.disableBuiltIn).toHaveBeenCalledTimes(3);
	events.emit("MAIL_SEND_SUCCESS");
	expect(view.sent).toHaveBeenCalledOnce();
	events.emit("MAIL_FAILED");
	expect(view.failed).toHaveBeenCalledOnce();
	expect(client.completeSend).toHaveBeenCalledWith(false);
	events.emit("MAIL_LOCK_SEND_ITEMS");
	expect(client.setLocked).toHaveBeenCalledWith(true);
	events.emit("MAIL_UNLOCK_SEND_ITEMS");
	expect(client.setLocked).toHaveBeenLastCalledWith(false);
	events.emit("MAIL_CLOSED");
	pending.shift()?.();
	expect(client.setOpen).toHaveBeenLastCalledWith(false);
	expect(ui.closePanel).toHaveBeenCalledWith("left", undefined, "mail");
	expect(view.cancel).toHaveBeenCalledOnce();
	module.shutdown();
	expect(client.restoreBuiltIn).toHaveBeenCalledOnce();
	ui.openPanel.mockClear();
	events.emit("MAIL_SHOW");
	expect(ui.openPanel).not.toHaveBeenCalled();
});
