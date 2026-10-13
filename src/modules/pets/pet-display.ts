import type { Pet } from "../../clients/pets-client";
import { expansionNames } from "../expansion-names";

export interface PetGroup {
	readonly id: number;
	readonly label: string;
	readonly pets: Pet[];
}

export function groupPets(pets: readonly Pet[]): PetGroup[] {
	const groups = new Map<number, PetGroup>();
	for (const pet of pets) {
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
