import type { Pet } from "../../clients/pets-client";
import { expansionNames } from "../expansion-names";

export interface PetGroup {
	readonly id: number;
	readonly label: string;
	readonly pets: PetTile[];
}

export interface PetTile extends Pet {
	readonly ownedCount: number;
}

export function groupPets(pets: readonly Pet[]): PetGroup[] {
	const groups = new Map<number, PetGroup>();
	const species = new Map<number, Pet[]>();
	for (const pet of pets) {
		let copies = species.get(pet.speciesId);
		if (!copies) {
			copies = [];
			species.set(pet.speciesId, copies);
		}
		if (!copies.some((copy) => copy.id === pet.id)) copies.push(pet);
	}
	for (const copies of species.values()) {
		const representative =
			copies.find((pet) => pet.collected && pet.favourite) ??
			copies.find((pet) => pet.collected) ??
			copies.at(0);
		if (!representative) continue;
		const pet: PetTile = {
			...representative,
			ownedCount: copies.reduce(
				(count, copy) => Math.max(count, copy.ownedCount ?? 0),
				copies.filter((copy) => copy.collected).length,
			),
		};
		const expansion = pet.expansionId ?? -2;
		for (const key of pet.collected && pet.favourite
			? [-1, expansion]
			: [expansion]) {
			let group = groups.get(key);
			if (!group) {
				group = {
					id: key,
					label:
						key === -1
							? "Favourites"
							: key === -2
								? "Unknown expansion"
								: (expansionNames.at(key) ?? `Expansion ${key}`),
					pets: [],
				};
				groups.set(key, group);
			}
			group.pets.push(pet);
		}
	}
	return [...groups.entries()]
		.sort(([a], [b]) => {
			if (a === b) return 0;
			if (a === -1 || b === -2) return -1;
			if (b === -1 || a === -2) return 1;
			return b - a;
		})
		.map(([, group]) => {
			group.pets.sort((a, b) =>
				a.name === b.name
					? a.id < b.id
						? -1
						: a.id === b.id
							? 0
							: 1
					: a.name < b.name
						? -1
						: 1,
			);
			return group;
		});
}
