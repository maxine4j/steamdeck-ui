import { expect, it, vi } from "vitest";
import type { ModalOption } from "../../ui/components/modal";
import { EquipmentActionMenu } from "./equipment-action-menu";

it("offers unequip, every substitute across pages, and cancel; empty slots only offer substitutes", () => {
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, next: readonly ModalOption[]) => {
			options = next;
		}),
		close: vi.fn(),
	};
	const substitutes = Array.from({ length: 19 }, (_, index) => ({
		location: index,
		itemId: index + 100,
		name: `Spare ${index}`,
	}));
	const actions = {
		getSubstitutes: vi.fn(() => substitutes),
		unequip: vi.fn(),
		equipSubstitute: vi.fn(),
	};
	const menu = new EquipmentActionMenu(modal, actions);
	const slot = {
		slotId: 1,
		name: "Head",
		icon: 123,
		quality: 4,
		itemId: 42,
		hyperlink: "item:42",
	};
	menu.open(slot);
	expect(options.at(0)?.label).toBe("|A:common-icon-redx:18:18|a Unequip");
	options.at(0)?.select();
	expect(actions.unequip).toHaveBeenCalledWith(slot);
	const seen: string[] = [];
	for (let page = 0; page < 3; page++) {
		for (const option of options.filter((option) =>
			option.id.startsWith("equip-"),
		)) {
			seen.push(option.label);
			option.select();
		}
		if (page < 2)
			expect(options.find((option) => option.id === "next")?.label).toBe(
				"|TInterface\\Buttons\\UI-SpellbookIcon-NextPage-Up:18:18|t More items",
			);
		options.find((option) => option.id === "next")?.select();
	}
	expect(seen).toEqual(
		substitutes.map(
			(item) => `|A:lootroll-toast-icon-transmog-up:18:18|a Equip ${item.name}`,
		),
	);
	expect(actions.equipSubstitute).toHaveBeenCalledWith(
		slot,
		substitutes.at(-1),
	);
	options.find((option) => option.id === "previous")?.select();
	expect(options.find((option) => option.id === "previous")?.label).toBe(
		"|TInterface\\Buttons\\UI-SpellbookIcon-PrevPage-Up:18:18|t Previous items",
	);
	expect(options.find((option) => option.id.startsWith("equip-"))?.label).toBe(
		"|A:lootroll-toast-icon-transmog-up:18:18|a Equip Spare 8",
	);
	expect(options.find((option) => option.id === "cancel")?.label).toBe(
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	);
	options.find((option) => option.id === "cancel")?.select();
	expect(modal.close).toHaveBeenCalledOnce();
	menu.open({ ...slot, itemId: undefined, hyperlink: undefined });
	expect(options.some((option) => option.id === "unequip")).toBe(false);
});
