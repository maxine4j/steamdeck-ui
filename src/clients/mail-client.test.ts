import { afterEach, expect, it, vi } from "vitest";
import { NativeScriptSuppression } from "../ui/components/native-script-suppression";
import { MailClient } from "./mail-client";

afterEach(() => vi.unstubAllGlobals());
function setup() {
	const header = [
		1,
		2,
		"Sender",
		"Subject",
		123,
		0,
		30,
		1,
		false,
		false,
		false,
		true,
		false,
	];
	const api = {
		GetInboxNumItems: vi.fn(() => [1, 3]),
		GetInboxHeaderInfo: vi.fn(() => header),
		GetInboxText: vi.fn(() => ["Body", 1, 1, true, false]),
		HasInboxItem: vi.fn((_mail: number, slot: number) => slot === 2),
		GetInboxItem: vi.fn(() => ["Sword", 42, 99, 2, 3]),
		GetInboxItemLink: vi.fn(() => "item:42"),
		InboxItemCanDelete: vi.fn(() => true),
		TakeInboxMoney: vi.fn(),
		TakeInboxItem: vi.fn(),
		TakeInboxTextItem: vi.fn(),
		DeleteInboxItem: vi.fn(),
		ReturnInboxItem: vi.fn(),
		CloseMail: vi.fn(),
		CheckInbox: vi.fn(),
		GetSendMailItem: vi.fn((slot: number) =>
			slot === 1 ? ["Sword", 42, 99, 2] : [],
		),
		GetSendMailItemLink: vi.fn(() => "item:42"),
		ClickSendMailItemButton: vi.fn(),
		GetSendMailPrice: () => 30,
		SetSendMailMoney: vi.fn(),
		SetSendMailCOD: vi.fn(),
		SendMail: vi.fn(),
		SetSendMailShowing: vi.fn(),
		GetMoney: vi.fn(() => 1000000),
		InCombatLockdown: vi.fn(() => false),
		CursorHasItem: vi.fn(() => false),
		GameLimitedMode_IsActive: () => false,
		C_Mail: {
			IsCommandPending: vi.fn(() => false),
			CanCheckInbox: () => [true, 0],
		},
	};
	vi.stubGlobal("_G", api);
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const client = new MailClient(frames, {
		suppress: vi.fn(),
		restore: vi.fn(),
	});
	client.setOpen(true);
	return { client, api, header, frames };
}
it("reads inbox counts, sparse attachments and letter details only while open", () => {
	const { client } = setup();
	expect(client.getInbox()).toMatchObject({
		total: 3,
		messages: [
			{
				index: 1,
				sender: "Sender",
				subject: "Subject",
				money: 123,
				unread: true,
			},
		],
	});
	const mail = client.getInbox().messages.at(0);
	if (!mail) throw new Error("Expected inbox message");
	expect(client.read(mail)).toMatchObject({
		body: "Body",
		canCopy: true,
		attachments: [{ slot: 2, name: "Sword", count: 2, hyperlink: "item:42" }],
	});
	client.setOpen(false);
	expect(client.getInbox()).toEqual({ total: 0, messages: [] });
	expect(client.read(mail)).toBeUndefined();
});
it("revalidates mail identity and serializes actions; COD requires explicit payment", () => {
	const { client, api, header } = setup();
	const mail = client.getInbox().messages.at(0);
	if (!mail) throw new Error("Expected inbox message");
	client.takeMoney(mail);
	expect(api.TakeInboxMoney).toHaveBeenCalledExactlyOnceWith(1);
	api.C_Mail.IsCommandPending.mockReturnValue(true);
	client.takeItem(mail, 2, false);
	expect(api.TakeInboxItem).not.toHaveBeenCalled();
	api.C_Mail.IsCommandPending.mockReturnValue(false);
	header[5] = 200;
	client.takeItem(mail, 2, false);
	expect(api.TakeInboxItem).not.toHaveBeenCalled();
	const codMail = client.getInbox().messages.at(0);
	if (!codMail) throw new Error("Expected COD message");
	client.takeItem(codMail, 2, true);
	expect(api.TakeInboxItem).toHaveBeenCalledExactlyOnceWith(1, 2);
	header[3] = "Different mail";
	client.delete(mail);
	client.return(mail);
	client.copyLetter(mail);
	expect(api.DeleteInboxItem).not.toHaveBeenCalled();
	expect(api.ReturnInboxItem).not.toHaveBeenCalled();
	expect(api.TakeInboxTextItem).not.toHaveBeenCalled();
});
it("guards deletion and return, copies letters and retrieves one safe bulk attachment at a time", () => {
	const { client, api, header } = setup();
	const mail = client.getInbox().messages.at(0);
	if (!mail) throw new Error("Expected inbox message");
	client.delete(mail);
	expect(api.DeleteInboxItem).not.toHaveBeenCalled();
	client.return(mail);
	expect(api.ReturnInboxItem).toHaveBeenCalledWith(1);
	client.copyLetter(mail);
	expect(api.TakeInboxTextItem).toHaveBeenCalledWith(1);
	expect(client.collectNext()).toBe(true);
	expect(api.TakeInboxMoney).toHaveBeenCalledWith(1);
	header[4] = 0;
	expect(client.collectNext()).toBe(true);
	expect(api.TakeInboxItem).toHaveBeenCalledWith(1, 2);
	header[5] = 100;
	expect(client.collectNext()).toBe(false);
	header[5] = 0;
	header[12] = true;
	expect(client.collectNext()).toBe(false);
	header[12] = false;
	header[7] = 0;
	api.HasInboxItem.mockReturnValue(false);
	client.delete(mail);
	expect(api.DeleteInboxItem).toHaveBeenCalledWith(1);
});
it("validates send drafts, prevents duplicate sends, attaches and removes items", () => {
	const { client, api } = setup();
	const draft = {
		recipient: "Friend",
		subject: "Gift",
		body: "Hello",
		copper: 100,
		cod: false,
	};
	expect(client.getSendState()).toMatchObject({
		postage: 30,
		attachments: [{ slot: 1, name: "Sword" }],
	});
	expect(client.send({ ...draft, recipient: "" })).toBe(false);
	expect(client.send({ ...draft, copper: -1 })).toBe(false);
	expect(client.send({ ...draft, copper: 1000001 })).toBe(false);
	expect(client.send(draft)).toBe(true);
	expect(api.SetSendMailCOD).toHaveBeenCalledWith(0);
	expect(api.SetSendMailMoney).toHaveBeenCalledWith(100);
	expect(api.SendMail).toHaveBeenCalledExactlyOnceWith(
		"Friend",
		"Gift",
		"Hello",
		undefined,
	);
	expect(client.send(draft)).toBe(false);
	client.completeSend(false);
	expect(client.send({ ...draft, cod: true })).toBe(true);
	expect(api.SetSendMailCOD).toHaveBeenLastCalledWith(100);
	client.completeSend(true);
	api.CursorHasItem.mockReturnValue(true);
	client.attach(2);
	expect(api.ClickSendMailItemButton).toHaveBeenCalledWith(2, false);
	api.CursorHasItem.mockReturnValue(false);
	client.removeAttachment(1);
	expect(api.ClickSendMailItemButton).toHaveBeenCalledWith(1, true);
	client.setOpen(false);
	client.attach(2);
	client.send(draft);
	expect(api.SendMail).toHaveBeenCalledTimes(2);
});
it("suppresses both native mail windows and respects inbox refresh throttling", () => {
	const { client, api, frames } = setup();
	const frame = { GetParent: vi.fn() };
	Object.assign(api, { MailFrame: frame, OpenMailFrame: frame });
	client.disableBuiltIn();
	expect(frames.suppress).toHaveBeenCalledWith([frame, frame]);
	client.checkInbox();
	expect(api.CheckInbox).toHaveBeenCalledOnce();
	client.close();
	expect(api.CloseMail).toHaveBeenCalledOnce();
	client.restoreBuiltIn();
	expect(frames.restore).toHaveBeenCalledOnce();
});

it("rejects stale inbox actions after updates, including identical subjects", () => {
	const { client, api } = setup();
	const mail = client.getInbox().messages.at(0);
	if (!mail) throw new Error("Expected message");
	client.invalidateInbox();
	client.takeMoney(mail);
	client.delete(mail);
	client.return(mail);
	expect(api.TakeInboxMoney).not.toHaveBeenCalled();
	expect(api.ReturnInboxItem).not.toHaveBeenCalled();
	expect(client.read(mail)).toBeUndefined();
});
it("enforces the native letter size and COD cap", () => {
	const { client } = setup();
	const draft = {
		recipient: "Friend",
		subject: "Gift",
		body: "x".repeat(501),
		copper: 0,
		cod: false,
	};
	expect(client.send(draft)).toBe(false);
	expect(
		client.send({ ...draft, body: "", copper: 100000001, cod: true }),
	).toBe(false);
});

it("reads auction invoices and crafting order details", () => {
	const { client, api } = setup();
	Object.assign(api, {
		GetInboxInvoiceInfo: () => [
			"seller",
			"Sword",
			"Buyer",
			20000,
			0,
			1000,
			500,
			0,
			0,
			0,
			2,
		],
	});
	api.GetInboxText.mockReturnValue(["", 1, 1, false, true]);
	const mail = client.getInbox().messages.at(0);
	if (!mail) throw new Error("Expected message");
	expect(client.read(mail)?.invoice).toMatchObject({
		kind: "seller",
		item: "Sword",
		player: "Buyer",
		price: 20000,
		deposit: 1000,
		cut: 500,
		count: 2,
	});
	Object.assign(api.C_Mail, {
		GetCraftingOrderMailInfo: () => ({
			recipeName: "Sword",
			crafterName: "Smith",
			customerName: "Friend",
			commissionPaid: 500,
			crafterNote: "Enjoy",
		}),
	});
	api.GetInboxText.mockReturnValue(["", 1, 1, false, false, true]);
	expect(client.read(mail)?.order).toEqual({
		recipe: "Sword",
		crafter: "Smith",
		customer: "Friend",
		commission: 500,
		note: "Enjoy",
	});
});

it("opens Blizzard's report flow for the current player mail only", () => {
	const { client, api, header } = setup();
	const report = { CreateMailReportInfo: vi.fn(() => "report") };
	const reportFrame = { InitiateReport: vi.fn() };
	Object.assign(api, {
		ReportInfo: report,
		ReportFrame: reportFrame,
		Enum: { ReportType: { Mail: 10 } },
	});
	const mail = client.getInbox().messages.at(0);
	if (!mail) throw new Error("Expected message");
	client.report(mail);
	expect(report.CreateMailReportInfo).toHaveBeenCalledWith(10, 1);
	expect(reportFrame.InitiateReport).toHaveBeenCalledWith("report", "Sender");
	header[12] = true;
	client.report(mail);
	expect(reportFrame.InitiateReport).toHaveBeenCalledOnce();
});

it("suppresses native OnHide before reparenting so replacing a shown mailbox does not close the interaction", () => {
	const { api } = setup();
	const closed = vi.fn();
	let onHide: (() => void) | undefined = closed;
	const frame = {
		GetParent: vi.fn(),
		GetScript: () => onHide,
		SetScript: (_name: string, callback?: () => void) => {
			onHide = callback;
		},
		Hide: vi.fn(),
	};
	Object.assign(api, { MailFrame: frame });
	const frames = { suppress: vi.fn(() => onHide?.()), restore: vi.fn() };
	const client = new MailClient(frames, new NativeScriptSuppression());
	client.setOpen(true);
	client.disableBuiltIn();
	expect(closed).not.toHaveBeenCalled();
	client.setOpen(false);
	expect(api.SetSendMailShowing).toHaveBeenLastCalledWith(false);
	client.restoreBuiltIn();
	expect(onHide).toBe(closed);
});
