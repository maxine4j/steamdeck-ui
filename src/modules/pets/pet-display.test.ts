import { expect, it } from "vitest";
import { getPetExpansion } from "../../clients/pet-expansions";
import type { Pet } from "../../clients/pets-client";
import { groupPets } from "./pet-display";

it("collapses owned copies by species, prefers a favourite GUID and retains the global collection count", () => {
	const first: Pet = {
		id: "Pet-1",
		speciesId: 39,
		name: "Cat",
		icon: 1,
		collected: true,
		favourite: false,
		expansionId: 0,
		ownedCount: 3,
	};
	const favourite = { ...first, id: "Pet-2", favourite: true };
	const groups = groupPets([first, favourite, { ...first, id: "Pet-3" }]);
	expect(
		groups.map((group) => group.pets.map((pet) => [pet.id, pet.ownedCount])),
	).toEqual([[["Pet-2", 3]], [["Pet-2", 3]]]);
	expect(groupPets([first]).at(0)?.pets.at(0)?.ownedCount).toBe(3);
});

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
