import type { MailDetail } from "../../clients/mail-client";
import { formatMoney } from "../../utils/money";

export function formatMailBody(detail: MailDetail): string {
	let text = detail.body;
	if (detail.invoice) {
		const invoice = detail.invoice;
		text += `\n\nAuction ${invoice.kind === "buyer" ? "purchase" : "sale"}: ${invoice.item} ×${invoice.count}\n${invoice.player}\nPrice: ${formatMoney(invoice.price)}`;
		if (invoice.kind !== "buyer")
			text += `\nDeposit returned: ${formatMoney(invoice.deposit)}\nAuction house cut: ${formatMoney(invoice.cut)}\nProceeds: ${formatMoney(invoice.price + invoice.deposit - invoice.cut)}`;
		if (invoice.kind === "seller_temp_invoice")
			text += `\nFunds pending (${invoice.delayMinutes} minutes)`;
	}
	if (detail.order) {
		const order = detail.order;
		text += `\n\nCrafting order: ${order.recipe}\nCrafter: ${order.crafter}\nCustomer: ${order.customer}\nCommission: ${formatMoney(order.commission)}\n${order.note}`;
	}
	return text;
}
