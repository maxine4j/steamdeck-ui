import type {
	InventoryItem,
	ItemCategory,
} from "../../clients/inventory-client";
export type GroupMode = "category" | "expansion";
export interface DisplayItem extends InventoryItem {
	readonly sources: readonly InventoryItem[];
}
export interface ItemGroup {
	readonly label: string;
	readonly items: DisplayItem[];
}
const categories: readonly ItemCategory[] = [
	"Equipment",
	"Reagents",
	"Consumables",
	"Quest",
	"Recipes",
	"Junk",
	"Miscellaneous",
];
const expansions = [
	"Classic",
	"The Burning Crusade",
	"Wrath of the Lich King",
	"Cataclysm",
	"Mists of Pandaria",
	"Warlords of Draenor",
	"Legion",
	"Battle for Azeroth",
	"Shadowlands",
	"Dragonflight",
	"The War Within",
	"Midnight",
];
export function groupItems(
	items: readonly InventoryItem[],
	mode: GroupMode,
): ItemGroup[] {
	const groups = new Map<number, ItemGroup>();
	const combined = new Map<string, DisplayItem>();
	for (const item of items) {
		const order =
			mode === "category"
				? categories.indexOf(item.category)
				: (item.expansionId ?? 999);
		let group = groups.get(order);
		if (!group) {
			group = {
				label:
					mode === "category"
						? item.category
						: item.expansionId === undefined
							? "Unknown expansion"
							: (expansions.at(item.expansionId) ??
								`Expansion ${item.expansionId}`),
				items: [],
			};
			groups.set(order, group);
		}
		const key = `${order}:${item.itemId}:${item.hyperlink ?? ""}:${item.quality}`;
		const previous = item.stackable ? combined.get(key) : undefined;
		if (previous) {
			const merged = {
				...previous,
				count: previous.count + item.count,
				sources: [...previous.sources, item],
			};
			const index = group.items.indexOf(previous);
			group.items.splice(index, 1, merged);
			combined.set(key, merged);
		} else {
			const display = { ...item, sources: [item] };
			group.items.push(display);
			if (item.stackable) combined.set(key, display);
		}
	}
	return [...groups.entries()]
		.sort((a, b) => {
			if (mode === "category") return a[0] - b[0];
			if (a[0] === 999) return 1;
			if (b[0] === 999) return -1;
			return b[0] - a[0];
		})
		.map((entry) => {
			entry[1].items.sort((a, b) => {
				if (a.itemId !== b.itemId) return a.itemId - b.itemId;
				if (a.bagId !== b.bagId) return a.bagId - b.bagId;
				return a.slotId - b.slotId;
			});
			return entry[1];
		});
}
export function commaNumber(value: number): string {
	const digits = `${Math.floor(value)}`;
	let result = "";
	for (let i = 0; i < digits.length; i++) {
		if (i > 0 && (digits.length - i) % 3 === 0) result += ",";
		result += digits.charAt(i);
	}
	return result;
}
export function formatMoney(copper: number): string {
	return `${commaNumber(Math.floor(copper / 10000))}|TInterface\\MoneyFrame\\UI-GoldIcon:14:14|t  ${Math.floor(copper / 100) % 100}|TInterface\\MoneyFrame\\UI-SilverIcon:14:14|t  ${copper % 100}|TInterface\\MoneyFrame\\UI-CopperIcon:14:14|t`;
}
