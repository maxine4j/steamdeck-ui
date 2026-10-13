import { expect, it, vi } from "vitest";
import type { Pet } from "../../clients/pets-client";
import type { IModal, ModalOption } from "../../ui/components/modal";
import { PetActionMenu } from "./pet-action-menu";

it("offers summon and favourite for owned pets and only cancel for unowned pets", () => {
	const modal = { open: vi.fn(), close: vi.fn() } as unknown as IModal;
	const client = {
		canUse: vi.fn(() => true),
		summon: vi.fn(),
		toggleFavourite: vi.fn(),
	};
	const refresh = vi.fn();
	const menu = new PetActionMenu(modal, client, refresh);
	const pet: Pet = {
		id: "Pet-1",
		speciesId: 39,
		name: "Cat",
		icon: 123,
		favourite: false,
		collected: true,
	};
	menu.open(pet);
	const options = vi.mocked(modal.open).mock.lastCall?.at(1) as ModalOption[];
	expect(options.map((option) => option.id)).toEqual([
		"summon",
		"favourite",
		"cancel",
	]);
	options.at(0)?.select();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith("Pet-1");
	options.at(1)?.select();
	expect(client.toggleFavourite).toHaveBeenCalledExactlyOnceWith("Pet-1");
	expect(refresh).toHaveBeenCalledOnce();
	menu.open({ ...pet, collected: false });
	expect(
		((vi.mocked(modal.open).mock.lastCall?.at(1) ?? []) as ModalOption[]).map(
			(option) => option.id,
		),
	).toEqual(["cancel"]);
});
