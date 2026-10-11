import { expect, it } from "vitest";
import type { InventoryItem } from "../../clients/inventory-client";
import { formatMoney, groupItems } from "./bag-display";

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
	bagId: 0,
	slotId: 1,
	itemId: 42,
	iconFileId: 123,
	count: 200,
	quality: 1,
	category: "Reagents",
	expansionId: 10,
	stackable: true,
	...overrides,
});

it("combines matching stacks and retains their source slots", () => {
	const groups = groupItems(
		[item(), item({ slotId: 2 }), item({ slotId: 3, count: 53 })],
		"category",
	);
	expect(groups.at(0)?.label).toBe("Reagents");
	expect(groups.at(0)?.items).toHaveLength(1);
	expect(groups.at(0)?.items.at(0)?.count).toBe(453);
	expect(groups.at(0)?.items.at(0)?.sources).toHaveLength(3);
});

it("keeps gear variants separate and switches to expansion groups", () => {
	const items = [
		item({ category: "Equipment", stackable: false, itemLevel: 100 }),
		item({ category: "Equipment", stackable: false, itemLevel: 110 }),
		item({ expansionId: undefined }),
	];
	expect(groupItems(items, "category").at(0)?.items).toHaveLength(2);
	expect(groupItems(items, "expansion").map((group) => group.label)).toEqual([
		"The War Within",
		"Unknown expansion",
	]);
});

it("formats all denominations with comma-separated gold and coin icons", () => {
	expect(formatMoney(123456789)).toBe(
		"12,345|TInterface\\MoneyFrame\\UI-GoldIcon:14:14|t  67|TInterface\\MoneyFrame\\UI-SilverIcon:14:14|t  89|TInterface\\MoneyFrame\\UI-CopperIcon:14:14|t",
	);
});

it("keeps distinct stackable variants separate and sorts source slots deterministically", () => {
	const groups = groupItems(
		[
			item({ hyperlink: "item:42:variant-a", bagId: 1, slotId: 3 }),
			item({ hyperlink: "item:42:variant-b", bagId: 0, slotId: 2 }),
			item({ hyperlink: "item:42:variant-a", bagId: 2, slotId: 1 }),
		],
		"category",
	);
	expect(groups.at(0)?.items.map((item) => item.count)).toEqual([200, 400]);
	expect(groups.at(0)?.items.map((item) => item.bagId)).toEqual([0, 1]);
});
