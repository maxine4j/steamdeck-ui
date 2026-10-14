import type {
	IMailClient,
	MailDraft,
	MailMessage,
} from "../../clients/mail-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import type { IModal } from "../../ui/components/modal";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import { ScrollText } from "../../ui/components/scroll-text";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import { formatMoney } from "../bags/bag-display";
import { formatMailBody } from "./mail-body";

function confirm(modal: IModal, title: string, action: () => void): void {
	modal.open(title, [
		{ id: "cancel", label: "Cancel", select: () => modal.close() },
		{
			id: "confirm",
			label: "Confirm",
			select: () => {
				modal.close();
				action();
			},
		},
	]);
}
export class MailInboxPanel implements IPanel {
	readonly id = "mail-inbox";
	readonly title = "Inbox";
	readonly icon = 133469;
	private readonly frame: Frame;
	private readonly reading: Frame;
	private readonly body: ScrollText;
	private readonly list: ScrollList;
	private readonly actions: ScrollList;
	private mounted = false;
	private selected?: MailMessage;
	private navigationChanged?: (focusId?: string) => void;
	private collecting = false;
	private cancelCollection?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IMailClient,
		private readonly modal: IModal,
		private readonly scheduler: ITaskScheduler,
		private readonly replyTo: (mail: MailMessage) => void,
	) {
		this.frame = new Frame("mail-inbox-root", pool);
		this.reading = new Frame("mail-reading", pool);
		this.body = new ScrollText("mail-body", pool);
		this.list = new ScrollList("mail-inbox-list", pool, "", () => {}, {
			top: 52,
			background: false,
		});
		this.actions = new ScrollList("mail-actions", pool, "", () => {}, {
			top: 328,
			background: false,
		});
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
		this.navigationChanged = callback;
	}
	refresh(): void {
		if (!this.mounted) return;
		const inbox = this.client.getInbox();
		if (this.selected) {
			const selected = this.selected;
			const current = inbox.messages.find(
				(mail) =>
					mail.index === selected.index &&
					mail.sender === selected.sender &&
					mail.subject === selected.subject,
			);
			if (!current) {
				this.selected = undefined;
				this.showInbox();
				return;
			}
			this.selected = current;
			this.showMessage(false);
			return;
		}
		this.list.setRows([
			{
				id: "mail-count",
				label: `${inbox.messages.length} of ${inbox.total} messages`,
				heading: true,
				activate: () => {},
			},
			{
				id: "mail-collect-all",
				label: this.collecting
					? "Stop collecting"
					: "Collect all items and money",
				detail: "Skips COD and GM messages",
				activate: () => (this.collecting ? this.cancel() : this.collect()),
			},
			{
				id: "mail-refresh",
				label: "Check for more mail",
				activate: () => this.client.checkInbox(),
			},
			...inbox.messages.map(
				(mail): ListRow => ({
					id: `mail-message-${mail.index}`,
					label: `${mail.unread ? "• " : ""}${mail.subject}`,
					icon: 133469,
					detail: `${mail.sender} · ${Math.ceil(mail.daysLeft)} days${mail.returned ? " · Returned" : ""}${mail.isGM ? " · GM" : ""}${mail.cod > 0 ? ` · COD ${formatMoney(mail.cod)}` : ""}${mail.money > 0 ? ` · ${formatMoney(mail.money)}` : ""}${mail.itemCount > 0 ? ` · ${mail.itemCount} items` : ""}`,
					activate: () => {
						if (!this.mounted) return;
						this.cancel();
						this.selected = mail;
						this.showMessage(true);
					},
				}),
			),
			...(inbox.messages.length === 0
				? [
						{
							id: "mail-empty",
							label: "No mail",
							heading: true,
							activate: () => {},
						},
					]
				: []),
		]);
		this.navigationChanged?.();
	}
	private showInbox(): void {
		this.frame.setLabel("sender", "");
		this.body.unmount();
		this.reading.hide();
		this.actions.unmount();
		this.list.mount(this.frame);
		this.refresh();
	}
	private showMessage(reset: boolean): void {
		const mail = this.selected;
		if (!mail) return;
		const detail = this.client.read(mail);
		if (!detail) {
			this.selected = undefined;
			this.showInbox();
			return;
		}
		this.list.unmount();
		this.frame.setLabel(
			"sender",
			`${mail.subject}\nFrom: ${mail.sender} · ${Math.ceil(mail.daysLeft)} days remaining`,
			"TOPLEFT",
			16,
			-52,
			14,
			452,
		);
		this.reading.setParent(this.frame);
		this.reading.layout(456, 212, "TOPLEFT", this.frame, 12, -104);
		this.reading.show();
		this.body.mount(this.reading, 456, 212);
		this.body.setText(formatMailBody(detail), reset);
		const guarded = (action: () => void) => {
			if (this.mounted && this.selected === mail) action();
		};
		const rows: ListRow[] = [
			{
				id: "mail-back",
				label: "Back to inbox",
				activate: () => this.onBack(),
			},
			...(mail.money > 0
				? [
						{
							id: "mail-money",
							label: `Take ${formatMoney(mail.money)}`,
							activate: () => guarded(() => this.client.takeMoney(mail)),
						},
					]
				: []),
			...detail.attachments.map(
				(item): ListRow => ({
					id: `mail-take-${item.slot}`,
					label: `${item.name} ×${item.count}`,
					icon: item.icon,
					detail:
						mail.cod > 0
							? `Pay COD: ${formatMoney(mail.cod)}`
							: "Take attachment",
					tooltipContent: item.hyperlink ? { item: item.hyperlink } : undefined,
					activate: () =>
						guarded(() =>
							mail.cod > 0
								? confirm(
										this.modal,
										`Pay ${formatMoney(mail.cod)} to ${mail.sender}?`,
										() =>
											guarded(() =>
												this.client.takeItem(mail, item.slot, true),
											),
									)
								: this.client.takeItem(mail, item.slot, false),
						),
				}),
			),
		];
		if (detail.canCopy)
			rows.push({
				id: "mail-copy",
				label: "Keep a copy of this letter",
				activate: () => guarded(() => this.client.copyLetter(mail)),
			});
		if (mail.canReply)
			rows.push({
				id: "mail-reply",
				label: "Reply",
				activate: () => guarded(() => this.replyTo(mail)),
			});
		if (detail.canDelete)
			rows.push({
				id: "mail-delete",
				label: "Delete letter",
				activate: () =>
					confirm(this.modal, `Delete “${mail.subject}”?`, () =>
						guarded(() => this.client.delete(mail)),
					),
			});
		if (mail.canReply && !mail.returned && !mail.isGM)
			rows.push({
				id: "mail-return",
				label: "Return to sender",
				activate: () =>
					confirm(
						this.modal,
						`Return “${mail.subject}” to ${mail.sender}?`,
						() => guarded(() => this.client.return(mail)),
					),
			});
		if (detail.canReport)
			rows.push({
				id: "mail-report",
				label: "Report mail",
				activate: () =>
					confirm(this.modal, `Report “${mail.subject}”?`, () =>
						guarded(() => this.client.report(mail)),
					),
			});
		this.actions.setRows(rows);
		this.actions.mount(this.frame);
		this.navigationChanged?.(reset ? "mail-body" : undefined);
	}
	private collect(): void {
		this.collecting = true;
		const next = () => {
			this.cancelCollection = undefined;
			if (!this.mounted || !this.collecting) return;
			if (this.client.getSendState().busy) {
				this.cancelCollection = this.scheduler.delay(0.3, next);
				return;
			}
			if (!this.client.collectNext()) {
				this.collecting = false;
				this.refresh();
				return;
			}
			this.cancelCollection = this.scheduler.delay(0.3, next);
		};
		next();
		this.refresh();
	}
	cancel(): void {
		this.collecting = false;
		this.cancelCollection?.();
		this.cancelCollection = undefined;
		this.modal.close();
	}
	reset(): void {
		this.cancel();
		this.selected = undefined;
		if (this.mounted) this.showInbox();
	}
	failed(): void {
		this.cancel();
		this.refresh();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Mail requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.mounted = true;
		this.frame.show();
		if (this.selected) this.showMessage(true);
		else this.showInbox();
	}
	onUnmount(): void {
		this.mounted = false;
		this.cancel();
		this.list.unmount();
		this.actions.unmount();
		this.body.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.client.close();
	}
	onBack(): void {
		if (this.selected) {
			this.selected = undefined;
			this.frame.setLabel("sender", "");
			this.showInbox();
		} else this.client.close();
	}
	getNavGrid(): NavGrid {
		return !this.mounted
			? []
			: this.selected
				? [[this.body.node], ...this.actions.getNavGrid()]
				: this.list.getNavGrid();
	}
	destroy(): void {
		this.onUnmount();
		this.body.destroy();
		this.actions.destroy();
		this.list.destroy();
		this.reading.destroy();
		this.frame.destroy();
	}
}

export class MailSendPanel implements IPanel {
	readonly id = "mail-send";
	readonly title = "Send Mail";
	readonly icon = 133470;
	private readonly frame: Frame;
	private readonly bodyViewport: Frame;
	private readonly attachments: ScrollList;
	private readonly fields: {
		frame: Frame;
		node: INavigable;
		key: "recipient" | "subject" | "body" | "gold";
		label: string;
		y: number;
		height: number;
		max: number;
	}[];
	private readonly sendButton: Frame;
	private readonly codButton: Frame;
	private readonly sendNode: INavigable;
	private readonly codNode: INavigable;
	private draft: MailDraft = {
		recipient: "",
		subject: "",
		body: "",
		copper: 0,
		cod: false,
	};
	private mounted = false;
	private status = "";
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IMailClient,
		private readonly modal: IModal,
	) {
		this.frame = new Frame("mail-send-root", pool);
		this.bodyViewport = new Frame("mail-compose-scroll", pool, "ScrollFrame");
		this.attachments = new ScrollList(
			"mail-send-attachments",
			pool,
			"",
			() => {},
			{ top: 424, bottom: 76, background: false, columns: 2 },
		);
		this.fields = [
			{
				key: "recipient" as const,
				id: "mail-recipient",
				label: "To (Name-Realm)",
				y: 76,
				height: 32,
				max: 128,
			},
			{
				key: "subject" as const,
				id: "mail-subject",
				label: "Subject",
				y: 140,
				height: 32,
				max: 64,
			},
			{
				key: "body" as const,
				id: "mail-body-input",
				label: "Message",
				y: 204,
				height: 112,
				max: 500,
			},
			{
				key: "gold" as const,
				id: "mail-gold",
				label: "Gold (e.g. 1.25)",
				y: 352,
				height: 32,
				max: 16,
			},
		].map((field) => {
			const frame = new Frame(field.id, pool, "EditBox");
			return {
				...field,
				frame,
				node: this.node(frame, () => frame.focusInput()),
			};
		});
		this.sendButton = new Frame("mail-send", pool, "Button");
		this.codButton = new Frame("mail-cod", pool, "Button");
		this.sendNode = this.node(this.sendButton, () => this.send());
		this.codNode = this.node(this.codButton, () => {
			this.draft.cod = !this.draft.cod;
			this.refresh();
		});
	}
	private node(frame: Frame, interact: () => void): INavigable {
		return {
			navId: frame.id,
			onFocus: () => frame.setFocused(true),
			onBlur: () => {
				frame.setFocused(false);
				if (this.fields?.some((field) => field.frame === frame))
					frame.blurInput();
			},
			onInteract: () => {
				if (this.mounted) interact();
			},
		};
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	getDraft(): Readonly<MailDraft> {
		return { ...this.draft };
	}
	reset(): void {
		this.draft = {
			recipient: "",
			subject: "",
			body: "",
			copper: 0,
			cod: false,
		};
		this.status = "";
		this.syncFields();
		this.refresh();
	}
	reply(mail: MailMessage): void {
		this.draft.recipient = mail.sender;
		this.draft.subject = mail.subject.startsWith("Re: ")
			? mail.subject
			: `Re: ${mail.subject}`;
		this.draft.replyIndex = mail.index;
		this.draft.replyRevision = mail.revision;
		this.syncFields();
		this.refresh();
	}
	private syncFields(): void {
		if (!this.mounted) return;
		for (const field of this.fields)
			field.frame.setInputText(
				field.key === "gold"
					? `${this.draft.copper / 10000}`
					: this.draft[field.key],
			);
	}
	refresh(): void {
		if (!this.mounted) return;
		const state = this.client.getSendState();
		this.frame.setLabel(
			"postage",
			`${state.busy ? "Waiting for mail server…" : state.available ? `Postage: ${formatMoney(state.postage)}` : "Sending unavailable on this account"}${this.status.length > 0 ? ` · ${this.status}` : ""}`,
			"BOTTOMLEFT",
			16,
			56,
			12,
			448,
		);
		this.codButton.setLabel(
			"label",
			this.draft.cod ? "COD ✓" : "Send money",
			"CENTER",
			0,
			0,
			13,
		);
		this.attachments.setRows(
			Array.from({ length: 12 }, (_, index): ListRow => {
				const slot = index + 1;
				const item = state.attachments.find((item) => item.slot === slot);
				return {
					id: `mail-attach-${slot}`,
					label: item ? `${item.name} ×${item.count}` : `Attach item ${slot}`,
					icon: item?.icon,
					height: 36,
					enabled: !state.busy && state.available,
					detail: item ? "Activate to remove" : undefined,
					activate: () => {
						if (!this.mounted) return;
						if (item) this.client.removeAttachment(slot);
						else this.client.attach(slot);
					},
				};
			}),
		);
		this.navigationChanged?.();
	}
	private send(): void {
		const state = this.client.getSendState();
		if (state.busy || !state.available) return;
		if (
			this.draft.recipient.trim() === "" ||
			this.draft.subject.trim() === "" ||
			this.draft.copper < 0 ||
			(this.draft.cod && state.attachments.length === 0)
		) {
			this.status = "Enter recipient, subject and a valid amount";
			this.refresh();
			return;
		}
		const draft = { ...this.draft };
		confirm(
			this.modal,
			`Send to ${draft.recipient}${draft.copper > 0 ? ` · ${draft.cod ? "COD" : "Gift"} ${formatMoney(draft.copper)}` : ""}?`,
			() => {
				if (!this.mounted) return;
				this.status = this.client.send(draft)
					? "Sending…"
					: "Cannot send: check amount, funds and attachments";
				this.refresh();
			},
		);
	}
	sent(): void {
		this.reset();
		this.status = "Mail sent";
		this.refresh();
	}
	failed(): void {
		this.modal.close();
		this.status = "Mail failed; draft retained";
		this.refresh();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Mail requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.mounted = true;
		this.client.setComposing(true);
		for (const field of this.fields) {
			this.frame.setLabel(
				field.key,
				field.label,
				"TOPLEFT",
				16,
				-field.y + 24,
				13,
			);
			if (field.key === "body") {
				this.bodyViewport.setParent(this.frame);
				this.bodyViewport.layout(
					452,
					field.height,
					"TOPLEFT",
					this.frame,
					16,
					-field.y,
				);
				this.bodyViewport.setInsetBackground();
				field.frame.setParent(this.bodyViewport);
				field.frame.layout(436, field.height, "TOPLEFT", this.bodyViewport);
				this.bodyViewport.setScrollContent(field.frame);
				this.bodyViewport.show();
			} else {
				field.frame.setParent(this.frame);
				field.frame.layout(
					452,
					field.height,
					"TOPLEFT",
					this.frame,
					16,
					-field.y,
				);
			}
			field.frame.setInsetBackground();
			field.frame.configureTextInput(
				(text) => {
					if (field.key === "gold") {
						const amount = text === "" ? 0 : Number(text);
						this.draft.copper =
							amount >= 0 && !Number.isNaN(amount)
								? Math.round(amount * 10000)
								: -1;
					} else this.draft[field.key] = text;
				},
				field.key === "body",
				field.max,
				field.key === "body" ? this.bodyViewport : undefined,
			);
			field.frame.show();
		}
		this.codButton.setParent(this.frame);
		this.codButton.layout(140, 28, "TOPRIGHT", this.frame, -16, -390);
		this.codButton.setButtonBackground();
		this.codButton.onClick(() => this.codNode.onInteract());
		this.codButton.show();
		this.sendButton.setParent(this.frame);
		this.sendButton.layout(452, 36, "BOTTOMLEFT", this.frame, 16, 12);
		this.sendButton.setButtonBackground();
		this.sendButton.setLabel("label", "Send mail", "CENTER", 0, 0, 14);
		this.sendButton.onClick(() => this.sendNode.onInteract());
		this.sendButton.show();
		this.frame.onReceiveDrag(() => {
			const slot = Array.from({ length: 12 }, (_, i) => i + 1).find(
				(slot) =>
					!this.client
						.getSendState()
						.attachments.some((item) => item.slot === slot),
			);
			if (slot) this.client.attach(slot);
		});
		this.attachments.mount(this.frame);
		this.syncFields();
		this.refresh();
		this.frame.show();
	}
	onUnmount(): void {
		this.mounted = false;
		this.modal.close();
		this.client.setComposing(false);
		for (const field of this.fields) field.frame.blurInput();
		this.attachments.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.client.close();
	}
	getNavGrid(): NavGrid {
		return !this.mounted
			? []
			: [
					...this.fields.map((field) => [field.node]),
					[this.codNode],
					...this.attachments.getNavGrid(),
					[this.sendNode],
				];
	}
	destroy(): void {
		this.onUnmount();
		this.attachments.destroy();
		this.bodyViewport.destroy();
		for (const field of this.fields) field.frame.destroy();
		this.sendButton.destroy();
		this.codButton.destroy();
		this.frame.destroy();
	}
}
