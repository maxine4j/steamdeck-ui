import type { Toy } from "../../clients/toys-client";

export interface ToyGroup {
	readonly label: string;
	readonly toys: Toy[];
}
const expansions = [
	"Classic",
	"The Burning Crusade",
	"Wrath of the Lich King",
	"Cataclysm",
	"Mists of Pandaria",
	"Warlords of Draenor",
	"Legion",
	"Battle for Azeroth",
	"Shadowlands",
	"Dragonflight",
	"The War Within",
	"Midnight",
];

export function groupToys(toys: readonly Toy[]): ToyGroup[] {
	const groups = new Map<number, ToyGroup>();
	for (const toy of toys) {
		const key = toy.favourite ? -1 : (toy.expansionId ?? -2);
		let group = groups.get(key);
		if (!group) {
			group = {
				label:
					key === -1
						? "Favourites"
						: key === -2
							? "Unknown expansion"
							: (expansions.at(key) ?? `Expansion ${key}`),
				toys: [],
			};
			groups.set(key, group);
		}
		group.toys.push(toy);
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
