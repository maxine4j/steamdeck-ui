import { expect, it, vi } from "vitest";
import type { IMailClient, MailMessage } from "../../clients/mail-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import type { IModal } from "../../ui/components/modal";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { MailInboxPanel, MailSendPanel } from "./mail-panel";

const { rows, inputs } = vi.hoisted(() => ({
	rows: new Map<string, readonly ListRow[]>(),
	inputs: new Map<string, (text: string) => void>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {}
		fill = vi.fn();
		setParent = vi.fn();
		layout = vi.fn();
		setWindowBackground = vi.fn();
		setInsetBackground = vi.fn();
		setLabel = vi.fn();
		setButtonBackground = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		setFocused = vi.fn();
		onClick = vi.fn();
		onReceiveDrag = vi.fn();
		setInputText = vi.fn();
		setScrollContent = vi.fn();
		focusInput = vi.fn();
		blurInput = vi.fn();
		configureTextInput(callback: (text: string) => void) {
			inputs.set(this.id, callback);
		}
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		constructor(readonly id: string) {}
		setRows(value: readonly ListRow[]) {
			rows.set(this.id, value);
		}
		mount = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
		resetScroll = vi.fn();
		getNavGrid() {
			return (rows.get(this.id) ?? [])
				.filter((row) => !row.heading && row.enabled !== false)
				.map((row) => [
					{
						navId: row.id,
						onFocus: vi.fn(),
						onBlur: vi.fn(),
						onInteract: row.activate,
					},
				]);
		}
	},
}));
vi.mock("../../ui/components/scroll-text", () => ({
	ScrollText: class {
		node = {
			navId: "mail-body",
			onFocus: vi.fn(),
			onBlur: vi.fn(),
			onInteract: vi.fn(),
		};
		mount = vi.fn();
		setText = vi.fn();
		unmount = vi.fn();
		destroy = vi.fn();
	},
}));
function setup() {
	const mail: MailMessage = {
		index: 1,
		sender: "Friend",
		subject: "Gift",
		money: 100,
		cod: 200,
		daysLeft: 29,
		itemCount: 1,
		unread: true,
		returned: false,
		textCreated: false,
		canReply: true,
		isGM: false,
	};
	const client: IMailClient = {
		report: vi.fn(),
		invalidateInbox: vi.fn(),
		setOpen: vi.fn(),
		disableBuiltIn: vi.fn(),
		restoreBuiltIn: vi.fn(),
		getInbox: vi.fn(() => ({ messages: [mail], total: 2 })),
		read: vi.fn(() => ({
			body: "Hello",
			attachments: [{ slot: 2, name: "Sword", icon: 1, count: 1 }],
			canCopy: true,
			canDelete: false,
		})),
		takeMoney: vi.fn(),
		takeItem: vi.fn(),
		copyLetter: vi.fn(),
		delete: vi.fn(),
		return: vi.fn(),
		collectNext: vi.fn(() => true),
		getSendState: vi.fn(() => ({
			attachments: [],
			postage: 30,
			money: 10000,
			available: true,
			busy: false,
		})),
		setComposing: vi.fn(),
		attach: vi.fn(),
		removeAttachment: vi.fn(),
		send: vi.fn(() => true),
		completeSend: vi.fn(),
		setLocked: vi.fn(),
		checkInbox: vi.fn(),
		close: vi.fn(),
	};
	const modal: IModal = { open: vi.fn(), close: vi.fn() };
	const pending: (() => void)[] = [];
	const scheduler = {
		delay: (_seconds: number, callback: () => void) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	} as ITaskScheduler;
	const pool = {} as IFramePoolManager;
	return {
		client,
		mail,
		modal,
		scheduler,
		pending,
		pool,
		parent: new Frame("parent", pool),
	};
}
function activate(
	panel: { getNavGrid(): { navId: string; onInteract(): void }[][] },
	id: string,
) {
	const node = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === id);
	expect(node, id).toBeDefined();
	node?.onInteract();
}

it("waits for pending commands during collection and resumes after the server responds", () => {
	const { client, modal, scheduler, pool, parent, pending } = setup();
	const panel = new MailInboxPanel(pool, client, modal, scheduler, vi.fn());
	panel.onMount(parent);
	activate(panel, "mail-collect-all");
	vi.mocked(client.getSendState).mockReturnValue({
		attachments: [],
		postage: 0,
		money: 0,
		available: true,
		busy: true,
	});
	pending.shift()?.();
	expect(client.collectNext).toHaveBeenCalledOnce();
	expect(pending).toHaveLength(1);
	vi.mocked(client.getSendState).mockReturnValue({
		attachments: [],
		postage: 0,
		money: 0,
		available: true,
		busy: false,
	});
	pending.shift()?.();
	expect(client.collectNext).toHaveBeenCalledTimes(2);
	panel.failed();
	pending.shift()?.();
	expect(client.collectNext).toHaveBeenCalledTimes(2);
});
it("reads mail, confirms COD and return, replies, goes back and stops collection on close", () => {
	const { client, mail, modal, scheduler, pool, parent, pending } = setup();
	const reply = vi.fn();
	const panel = new MailInboxPanel(pool, client, modal, scheduler, reply);
	panel.onMount(parent);
	activate(panel, "mail-message-1");
	expect(client.read).toHaveBeenCalledWith(mail);
	activate(panel, "mail-take-2");
	expect(client.takeItem).not.toHaveBeenCalled();
	const confirm = vi.mocked(modal.open).mock.calls.at(-1)?.at(1);
	if (Array.isArray(confirm))
		confirm.find((option) => option.id === "confirm")?.select();
	expect(client.takeItem).toHaveBeenCalledWith(mail, 2, true);
	activate(panel, "mail-reply");
	expect(reply).toHaveBeenCalledWith(mail);
	activate(panel, "mail-return");
	expect(client.return).not.toHaveBeenCalled();
	panel.onBack();
	activate(panel, "mail-collect-all");
	expect(client.collectNext).toHaveBeenCalledOnce();
	panel.onUnmount();
	pending.shift()?.();
	expect(client.collectNext).toHaveBeenCalledOnce();
	expect(panel.getNavGrid()).toEqual([]);
	panel.onContainerClosed();
	expect(client.close).toHaveBeenCalledOnce();
});
it("edits compose fields, confirms send, preserves failed drafts, clears successful drafts and supports attachment slots", () => {
	const { client, modal, pool, parent } = setup();
	const panel = new MailSendPanel(pool, client, modal);
	panel.onMount(parent);
	inputs.get("mail-recipient")?.("Friend");
	inputs.get("mail-subject")?.("Gift");
	inputs.get("mail-body-input")?.("Hello");
	inputs.get("mail-gold")?.("2.5");
	activate(panel, "mail-attach-1");
	expect(client.attach).toHaveBeenCalledWith(1);
	activate(panel, "mail-send");
	expect(client.send).not.toHaveBeenCalled();
	const confirm = vi.mocked(modal.open).mock.calls.at(-1)?.at(1);
	if (Array.isArray(confirm))
		confirm.find((option) => option.id === "confirm")?.select();
	expect(client.send).toHaveBeenCalledWith({
		recipient: "Friend",
		subject: "Gift",
		body: "Hello",
		copper: 25000,
		cod: false,
	});
	panel.failed();
	expect(panel.getDraft().recipient).toBe("Friend");
	panel.sent();
	expect(panel.getDraft().recipient).toBe("");
	panel.reply({ ...setup().mail, cod: 0 });
	expect(panel.getDraft()).toMatchObject({
		recipient: "Friend",
		subject: "Re: Gift",
		replyIndex: 1,
	});
	panel.onUnmount();
	expect(panel.getNavGrid()).toEqual([]);
});
