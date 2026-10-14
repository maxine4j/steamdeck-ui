import { expect, it } from "vitest";
import { formatMoney } from "../bags/bag-display";
import { formatMailBody } from "./mail-body";

it("renders sale invoices, pending funds and crafting orders alongside message text", () => {
	const detail = {
		body: "Message",
		attachments: [],
		canCopy: false,
		canDelete: false,
		invoice: {
			kind: "seller_temp_invoice",
			item: "Sword",
			player: "Buyer",
			price: 20000,
			deposit: 1000,
			cut: 500,
			count: 2,
			delayMinutes: 60,
		},
	};
	const text = formatMailBody(detail);
	expect(text).toContain("Message");
	expect(text).toContain("Auction sale: Sword ×2");
	expect(text).toContain(`Proceeds: ${formatMoney(20500)}`);
	expect(text).toContain("Funds pending (60 minutes)");
	expect(
		formatMailBody({
			...detail,
			invoice: { ...detail.invoice, kind: "buyer" },
		}),
	).not.toContain("Proceeds");
	expect(
		formatMailBody({
			...detail,
			invoice: undefined,
			order: {
				recipe: "Sword",
				crafter: "Smith",
				customer: "Friend",
				commission: 500,
				note: "Enjoy",
			},
		}),
	).toContain(
		`Crafter: Smith\nCustomer: Friend\nCommission: ${formatMoney(500)}\nEnjoy`,
	);
});
