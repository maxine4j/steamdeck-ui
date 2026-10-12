import type { Toy } from "../../clients/toys-client";
import { expansionNames } from "../expansion-names";

export interface ToyGroup {
	readonly id: number;
	readonly label: string;
	readonly toys: Toy[];
}

export function groupToys(toys: readonly Toy[]): ToyGroup[] {
	const groups = new Map<number, ToyGroup>();
	for (const toy of toys) {
		const expansion = toy.expansionId ?? -2;
		for (const key of toy.favourite ? [-1, expansion] : [expansion]) {
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
					toys: [],
				};
				groups.set(key, group);
			}
			group.toys.push(toy);
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
			group.toys.sort((a, b) =>
				a.name === b.name ? a.id - b.id : a.name < b.name ? -1 : 1,
			);
			return group;
		});
}
