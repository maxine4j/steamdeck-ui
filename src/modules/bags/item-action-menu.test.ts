import { expect, it, vi } from "vitest";
import type { InventoryItem } from "../../clients/inventory-client";
import type { ModalOption } from "../../ui/components/modal";
import { ItemActionMenu } from "./item-action-menu";

it("offers equip/use and cancel, and confirms destruction of one physical stack", () => {
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, next: readonly ModalOption[]) => {
			options = next;
		}),
		close: vi.fn(),
	};
	const actions = {
		useItem: vi.fn(),
		pickupItem: vi.fn(),
		destroyItem: vi.fn(),
	};
	const menu = new ItemActionMenu(modal, actions);
	const item: InventoryItem = {
		bagId: 0,
		slotId: 2,
		itemId: 42,
		count: 12,
		iconFileId: 1,
		quality: 1,
		category: "Equipment",
		stackable: false,
	};
	menu.open(item);
	expect(modal.open).toHaveBeenLastCalledWith(
		"Item actions",
		expect.any(Array),
		42,
	);
	menu.open({ ...item, hyperlink: "item:42:bonus:123" });
	expect(modal.open).toHaveBeenLastCalledWith(
		"Item actions",
		expect.any(Array),
		"item:42:bonus:123",
	);
	menu.open(item);
	expect(options.map((option) => option.label)).toEqual([
		"|A:lootroll-toast-icon-transmog-up:18:18|a Equip",
		"|A:common-icon-redx:18:18|a Destroy…",
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	]);
	options.at(0)?.select();
	expect(actions.useItem).toHaveBeenCalledExactlyOnceWith(item);
	menu.open({ ...item, category: "Consumables" });
	expect(options.at(0)?.label).toBe("|T1:18:18|t Use");
	menu.open(item);
	options.find((option) => option.id === "destroy")?.select();
	expect(actions.destroyItem).not.toHaveBeenCalled();
	expect(modal.open).toHaveBeenLastCalledWith(
		"Destroy this stack (12 items)?",
		expect.any(Array),
		42,
	);
	expect(options.at(0)?.label).toBe(
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	);
	expect(options.at(1)?.label).toBe(
		"|A:common-icon-redx:18:18|a Destroy stack",
	);
	options.find((option) => option.id === "confirm-destroy")?.select();
	expect(actions.destroyItem).toHaveBeenCalledExactlyOnceWith(item);
});
