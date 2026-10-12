import { expect, it, vi } from "vitest";
import type { Mount } from "../../clients/mounts-client";
import type { ModalOption } from "../../ui/components/modal";
import { MountActionMenu } from "./mount-action-menu";

it("shows the tooltip with use, favourite and cancel actions", () => {
	const mount: Mount = {
		id: 42,
		index: 1,
		name: "Horse",
		spell: 123,
		icon: 1,
		collected: true,
		usable: true,
		favourite: false,
	};
	let options: readonly ModalOption[] = [];
	const modal = {
		open: vi.fn((_title: string, next: readonly ModalOption[]) => {
			options = next;
		}),
		close: vi.fn(),
	};
	const summon = vi.fn();
	const canUse = vi.fn(() => true);
	const favourite = vi.fn();
	const menu = new MountActionMenu(modal, { summon, canUse }, favourite);
	menu.open(mount);
	expect(modal.open).toHaveBeenCalledWith("Mount actions", expect.any(Array), {
		mountSpell: 123,
	});
	expect(options.map((option) => option.label)).toEqual([
		"Use",
		"Favourite",
		"Cancel",
	]);
	options.at(0)?.select();
	expect(summon).toHaveBeenCalledExactlyOnceWith(42);
	options.at(1)?.select();
	expect(favourite).toHaveBeenCalledExactlyOnceWith(42);
	options.at(2)?.select();
	expect(modal.close).toHaveBeenCalledOnce();
	canUse.mockReturnValue(false);
	menu.open({ ...mount, favourite: true, usable: false });
	expect(options.map((option) => option.label)).toEqual([
		"Unfavourite",
		"Cancel",
	]);
	menu.open({ ...mount, collected: false });
	expect(options.map((option) => option.label)).toEqual(["Cancel"]);
});
