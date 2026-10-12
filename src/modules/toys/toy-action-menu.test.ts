import { expect, it, vi } from "vitest";
import type { Toy } from "../../clients/toys-client";
import type { ModalOption } from "../../ui/components/modal";
import { ToyActionMenu } from "./toy-action-menu";

const toy: Toy = {
	id: 42,
	name: "Train",
	icon: 1,
	collected: true,
	favourite: false,
};

it("opens the bags-style tooltip modal with secure use and favourite actions", () => {
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, next: readonly ModalOption[]) => {
			options = next;
		}),
		close: vi.fn(),
	};
	const client = { canUse: vi.fn(() => true), toggleFavourite: vi.fn() };
	const refresh = vi.fn();
	const menu = new ToyActionMenu(modal, client, refresh);
	menu.open(toy);
	expect(modal.open).toHaveBeenCalledWith("Toy actions", expect.any(Array), {
		toy: 42,
	});
	expect(options.map((option) => option.label)).toEqual([
		"|T1:18:18|t Use",
		"|A:collections-icon-favorites:18:18|a Favourite",
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	]);
	expect(options.at(0)?.toy).toBe(42);
	options.find((option) => option.id === "favourite")?.select();
	expect(client.toggleFavourite).toHaveBeenCalledExactlyOnceWith(42);
	expect(refresh).toHaveBeenCalledOnce();
	menu.open({ ...toy, favourite: true });
	expect(options.at(1)?.label).toBe("|A:common-icon-redx:18:18|a Unfavourite");
	client.canUse.mockReturnValue(false);
	menu.open(toy);
	expect(options.map((option) => option.label)).toEqual([
		"|A:collections-icon-favorites:18:18|a Favourite",
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	]);
	menu.open({ ...toy, collected: false });
	expect(options.map((option) => option.label)).toEqual([
		"|A:lootroll-toast-icon-pass-up:18:18|a Cancel",
	]);
	menu.close();
	expect(modal.close).toHaveBeenCalledOnce();
});
