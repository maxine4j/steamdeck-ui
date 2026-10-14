import type { WowFrame } from "../types";
import type { IFrameSuppression } from "../ui/components/frame-suppression";
import type {
	NativeScriptSuppression,
	ScriptedFrame,
} from "../ui/components/native-script-suppression";

export interface MailMessage {
	readonly revision?: number;
	readonly index: number;
	readonly sender: string;
	readonly subject: string;
	readonly money: number;
	readonly cod: number;
	readonly daysLeft: number;
	readonly itemCount: number;
	readonly unread: boolean;
	readonly returned: boolean;
	readonly textCreated: boolean;
	readonly canReply: boolean;
	readonly isGM: boolean;
}
export interface MailAttachment {
	readonly slot: number;
	readonly name: string;
	readonly icon: number;
	readonly count: number;
	readonly hyperlink?: string;
}
export interface MailDetail {
	readonly canReport?: boolean;
	readonly invoice?: MailInvoice;
	readonly order?: {
		recipe: string;
		crafter: string;
		customer: string;
		commission: number;
		note: string;
	};
	readonly body: string;
	readonly attachments: readonly MailAttachment[];
	readonly canCopy: boolean;
	readonly canDelete: boolean;
}
export interface MailInvoice {
	readonly kind: string;
	readonly item: string;
	readonly player: string;
	readonly price: number;
	readonly deposit: number;
	readonly cut: number;
	readonly count: number;
	readonly delayMinutes: number;
}
export interface MailDraft {
	recipient: string;
	subject: string;
	body: string;
	copper: number;
	cod: boolean;
	replyIndex?: number;
	replyRevision?: number;
}
export interface MailSendState {
	readonly attachments: readonly MailAttachment[];
	readonly postage: number;
	readonly money: number;
	readonly available: boolean;
	readonly busy: boolean;
}
export interface IMailClient {
	report(mail: MailMessage): void;
	invalidateInbox(): void;
	setOpen(open: boolean): void;
	disableBuiltIn(): void;
	restoreBuiltIn(): void;
	getInbox(): { messages: MailMessage[]; total: number };
	read(mail: MailMessage): MailDetail | undefined;
	takeMoney(mail: MailMessage): void;
	takeItem(mail: MailMessage, slot: number, payCOD: boolean): void;
	copyLetter(mail: MailMessage): void;
	delete(mail: MailMessage): void;
	return(mail: MailMessage): void;
	collectNext(): boolean;
	getSendState(): MailSendState;
	setComposing(composing: boolean): void;
	attach(slot: number): void;
	removeAttachment(slot: number): void;
	send(draft: MailDraft): boolean;
	completeSend(success: boolean): void;
	setLocked(locked: boolean): void;
	checkInbox(): void;
	close(): void;
}

// Legacy mail globals are absent or have flattened returns in generated declarations.
// Keep their actual FrameXML signatures here, at the client boundary.
interface MailApi {
	ReportInfo?: { CreateMailReportInfo(type: number, index: number): unknown };
	ReportFrame?: { InitiateReport(info: unknown, target: string): void };
	Enum: { ReportType: { Mail: number } };
	GetInboxNumItems(this: void): LuaMultiReturn<[number, number]>;
	GetInboxHeaderInfo(
		this: void,
		index: number,
	): LuaMultiReturn<
		[
			number | undefined,
			number,
			string | undefined,
			string | undefined,
			number,
			number,
			number,
			number | undefined,
			boolean,
			boolean,
			boolean,
			boolean,
			boolean,
		]
	>;
	GetInboxText(
		this: void,
		index: number,
	): LuaMultiReturn<
		[string | undefined, number, number, boolean, boolean, boolean]
	>;
	GetInboxInvoiceInfo(
		this: void,
		index: number,
	): LuaMultiReturn<
		[
			string | undefined,
			string,
			string | undefined,
			number,
			number,
			number,
			number,
			number,
			number,
			number,
			number | undefined,
		]
	>;
	GetInboxItem(
		this: void,
		index: number,
		slot: number,
	): LuaMultiReturn<[string | undefined, number, number, number]>;
	GetInboxItemLink(this: void, index: number, slot: number): string | undefined;
	HasInboxItem(this: void, index: number, slot: number): boolean;
	InboxItemCanDelete(this: void, index: number): boolean;
	TakeInboxMoney(this: void, index: number): void;
	TakeInboxItem(this: void, index: number, slot: number): void;
	TakeInboxTextItem(this: void, index: number): void;
	DeleteInboxItem(this: void, index: number): void;
	ReturnInboxItem(this: void, index: number): void;
	GetSendMailItem(
		this: void,
		slot: number,
	): LuaMultiReturn<[string | undefined, number, number, number]>;
	GetSendMailItemLink(this: void, slot: number): string | undefined;
	ClickSendMailItemButton(this: void, slot: number, remove: boolean): void;
	GetSendMailPrice(this: void): number;
	SetSendMailMoney(this: void, copper: number): void;
	SetSendMailCOD(this: void, copper: number): void;
	SetSendMailShowing(this: void, shown: boolean): void;
	SendMail(
		this: void,
		recipient: string,
		subject: string,
		body: string,
		replyIndex?: number,
	): void;
	GetMoney(this: void): number;
	InCombatLockdown(this: void): boolean;
	CursorHasItem(this: void): boolean;
	GameLimitedMode_IsActive(this: void): boolean;
	CheckInbox(this: void): void;
	CloseMail(this: void): void;
	C_Mail: {
		GetCraftingOrderMailInfo(this: void, index: number): CraftingOrderMailInfo;
		IsCommandPending(this: void): boolean;
		CanCheckInbox(this: void): LuaMultiReturn<[boolean, number]>;
	};
	MailFrame?: WowFrame & { GetParent(): WowFrame | undefined };
	OpenMailFrame?: WowFrame & { GetParent(): WowFrame | undefined };
}
export class MailClient implements IMailClient {
	private revision = 0;
	private open = false;
	private sending = false;
	private locked = false;
	constructor(
		private readonly frames: IFrameSuppression,
		private readonly scripts: Pick<
			NativeScriptSuppression,
			"suppress" | "restore"
		>,
	) {}
	private api(): MailApi {
		return _G as unknown as MailApi;
	}
	setOpen(open: boolean): void {
		this.invalidateInbox();
		this.open = open;
		if (!open) {
			this.api().SetSendMailShowing(false);
			this.sending = false;
			this.locked = false;
		}
	}
	invalidateInbox(): void {
		this.revision++;
	}
	disableBuiltIn(): void {
		const api = this.api();
		const frames = [api.MailFrame, api.OpenMailFrame].filter(
			(frame) => frame !== undefined,
		);
		for (const frame of frames)
			this.scripts.suppress(frame as unknown as ScriptedFrame, ["OnHide"]);
		if (frames.length > 0) this.frames.suppress(frames);
	}
	restoreBuiltIn(): void {
		this.frames.restore();
		this.scripts.restore();
	}
	private header(index: number): MailMessage | undefined {
		const [
			icon,
			,
			sender,
			subject,
			money,
			cod,
			daysLeft,
			itemCount,
			read,
			returned,
			textCreated,
			canReply,
			isGM,
		] = this.api().GetInboxHeaderInfo(index);
		if (icon === undefined || sender === undefined || subject === undefined)
			return undefined;
		return {
			index,
			revision: this.revision,
			sender,
			subject,
			money,
			cod,
			daysLeft,
			itemCount: itemCount ?? 0,
			unread: !read,
			returned,
			textCreated,
			canReply,
			isGM,
		};
	}
	getInbox(): { messages: MailMessage[]; total: number } {
		if (!this.open) return { messages: [], total: 0 };
		const [count, total] = this.api().GetInboxNumItems();
		const messages: MailMessage[] = [];
		for (let index = 1; index <= count; index++) {
			const mail = this.header(index);
			if (mail) messages.push(mail);
		}
		return { messages, total };
	}
	private current(mail: MailMessage): MailMessage | undefined {
		if (!this.open || mail.revision !== this.revision) return undefined;
		const current = this.header(mail.index);
		return current?.sender === mail.sender &&
			current.subject === mail.subject &&
			current.returned === mail.returned
			? current
			: undefined;
	}
	private usable(): boolean {
		return (
			this.open &&
			!this.sending &&
			!this.locked &&
			!this.api().InCombatLockdown() &&
			!this.api().C_Mail.IsCommandPending()
		);
	}
	read(mail: MailMessage): MailDetail | undefined {
		const current = this.current(mail);
		if (!current) return undefined;
		const api = this.api();
		const [body, , , takeable, isInvoice, isOrder] = api.GetInboxText(
			mail.index,
		);
		let invoice: MailInvoice | undefined;
		if (isInvoice) {
			const [kind, item, player, price, , deposit, cut, delay, , , count] =
				api.GetInboxInvoiceInfo(mail.index);
			if (kind)
				invoice = {
					kind,
					item,
					player: player ?? "Multiple players",
					price,
					deposit,
					cut,
					count: count ?? 1,
					delayMinutes: Math.ceil(delay / 60),
				};
		}
		const order = isOrder
			? api.C_Mail.GetCraftingOrderMailInfo(mail.index)
			: undefined;
		const attachments: MailAttachment[] = [];
		for (let slot = 1; slot <= 16; slot++) {
			if (!api.HasInboxItem(mail.index, slot)) continue;
			const [name, , icon, count] = api.GetInboxItem(mail.index, slot);
			if (name)
				attachments.push({
					slot,
					name,
					icon,
					count,
					hyperlink: api.GetInboxItemLink(mail.index, slot),
				});
		}
		return {
			body: body ?? "",
			canReport:
				!current.isGM &&
				api.ReportInfo !== undefined &&
				api.ReportFrame !== undefined,
			invoice,
			order: order
				? {
						recipe: order.recipeName,
						crafter: order.crafterName,
						customer: order.customerName,
						commission: order.commissionPaid,
						note: order.crafterNote,
					}
				: undefined,
			attachments,
			canCopy: takeable && !current.textCreated,
			canDelete:
				api.InboxItemCanDelete(mail.index) &&
				current.money === 0 &&
				current.itemCount === 0,
		};
	}
	takeMoney(mail: MailMessage): void {
		if (this.usable() && (this.current(mail)?.money ?? 0) > 0)
			this.api().TakeInboxMoney(mail.index);
	}
	takeItem(mail: MailMessage, slot: number, payCOD: boolean): void {
		if (!this.usable()) return;
		const current = this.current(mail);
		if (
			!current ||
			slot < 1 ||
			slot > 16 ||
			!this.api().HasInboxItem(mail.index, slot)
		)
			return;
		if (
			current.cod > 0 &&
			(!payCOD ||
				current.cod !== mail.cod ||
				current.cod > this.api().GetMoney())
		)
			return;
		this.api().TakeInboxItem(mail.index, slot);
	}
	copyLetter(mail: MailMessage): void {
		if (this.usable() && this.read(mail)?.canCopy)
			this.api().TakeInboxTextItem(mail.index);
	}
	delete(mail: MailMessage): void {
		if (this.usable() && this.read(mail)?.canDelete)
			this.api().DeleteInboxItem(mail.index);
	}
	return(mail: MailMessage): void {
		const current = this.current(mail);
		if (
			this.usable() &&
			current?.canReply &&
			!current.returned &&
			!current.isGM
		)
			this.api().ReturnInboxItem(mail.index);
	}
	report(mail: MailMessage): void {
		const current = this.current(mail);
		if (!current || current.isGM) return;
		const api = this.api();
		if (!api.ReportInfo || !api.ReportFrame) return;
		const info = api.ReportInfo.CreateMailReportInfo(
			api.Enum.ReportType.Mail,
			mail.index,
		);
		if (info)
			api.ReportFrame.InitiateReport(
				info,
				this.read(mail)?.order?.crafter ?? mail.sender,
			);
	}
	collectNext(): boolean {
		if (!this.usable()) return false;
		for (const mail of this.getInbox().messages) {
			if (mail.cod > 0 || mail.isGM) continue;
			if (mail.money > 0) {
				this.takeMoney(mail);
				return true;
			}
			for (let slot = 1; slot <= 16; slot++) {
				if (this.api().HasInboxItem(mail.index, slot)) {
					this.takeItem(mail, slot, false);
					return true;
				}
			}
		}
		return false;
	}
	getSendState(): MailSendState {
		if (!this.open)
			return {
				attachments: [],
				postage: 0,
				money: 0,
				available: false,
				busy: false,
			};
		const api = this.api();
		const attachments: MailAttachment[] = [];
		for (let slot = 1; slot <= 12; slot++) {
			const [name, , icon, count] = api.GetSendMailItem(slot);
			if (name)
				attachments.push({
					slot,
					name,
					icon,
					count,
					hyperlink: api.GetSendMailItemLink(slot),
				});
		}
		return {
			attachments,
			postage: api.GetSendMailPrice(),
			money: api.GetMoney(),
			available: !api.GameLimitedMode_IsActive(),
			busy: !this.usable(),
		};
	}
	setComposing(composing: boolean): void {
		if (this.open) this.api().SetSendMailShowing(composing);
	}
	attach(slot: number): void {
		if (this.usable() && slot >= 1 && slot <= 12 && this.api().CursorHasItem())
			this.api().ClickSendMailItemButton(slot, false);
	}
	removeAttachment(slot: number): void {
		if (this.usable() && slot >= 1 && slot <= 12 && !this.api().CursorHasItem())
			this.api().ClickSendMailItemButton(slot, true);
	}
	send(draft: MailDraft): boolean {
		const state = this.getSendState();
		if (
			!state.available ||
			state.busy ||
			draft.recipient.trim() === "" ||
			draft.subject.trim() === "" ||
			draft.copper < 0 ||
			draft.copper !== Math.floor(draft.copper) ||
			(draft.cod && draft.copper > 100000000) ||
			draft.body.length > 500 ||
			draft.subject.length > 64 ||
			(draft.cod && state.attachments.length === 0) ||
			state.money < state.postage + (draft.cod ? 0 : draft.copper)
		)
			return false;
		this.sending = true;
		const api = this.api();
		api.SetSendMailMoney(draft.cod ? 0 : draft.copper);
		api.SetSendMailCOD(draft.cod ? draft.copper : 0);
		api.SendMail(
			draft.recipient,
			draft.subject,
			draft.body,
			draft.replyRevision === this.revision ? draft.replyIndex : undefined,
		);
		return true;
	}
	completeSend(_success: boolean): void {
		this.sending = false;
	}
	setLocked(locked: boolean): void {
		this.locked = locked;
	}
	checkInbox(): void {
		if (!this.open) return;
		const [canCheck] = this.api().C_Mail.CanCheckInbox();
		if (canCheck) this.api().CheckInbox();
	}
	close(): void {
		if (this.open) this.api().CloseMail();
	}
}
