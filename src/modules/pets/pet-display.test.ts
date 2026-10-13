import { expect, it } from "vitest";
import { getPetExpansion } from "../../clients/pet-expansions";
import type { Pet } from "../../clients/pets-client";
import { groupPets } from "./pet-display";

it("keeps unknown expansion metadata separate and never favourites an uncollected pet", () => {
	const pet: Pet = {
		id: "species-999999",
		speciesId: 999999,
		name: "Unknown",
		icon: 1,
		collected: false,
		favourite: true,
	};
	expect(getPetExpansion(pet.speciesId)).toBeUndefined();
	expect(getPetExpansion(40)).toBe(0);
	expect(
		groupPets([pet]).map((group) => [group.label, group.pets.length]),
	).toEqual([["Unknown expansion", 1]]);
});
