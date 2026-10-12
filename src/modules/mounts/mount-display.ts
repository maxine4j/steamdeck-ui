import type { Mount } from "../../clients/mounts-client";
import { expansionNames } from "../expansion-names";

export interface MountGroup {
	readonly id: number;
	readonly label: string;
	readonly mounts: Mount[];
}

export function groupMounts(mounts: readonly Mount[]): MountGroup[] {
	const groups = new Map<number, MountGroup>();
	for (const mount of mounts) {
		const expansion = mount.expansionId ?? -2;
		for (const id of mount.favourite ? [-1, expansion] : [expansion]) {
			let group = groups.get(id);
			if (!group) {
				group = {
					id,
					label:
						id === -1
							? "Favourites"
							: id === -2
								? "Unknown expansion"
								: (expansionNames.at(id) ?? `Expansion ${id}`),
					mounts: [],
				};
				groups.set(id, group);
			}
			group.mounts.push(mount);
		}
	}
	return [...groups.values()]
		.sort((a, b) => {
			if (a.id === b.id) return 0;
			if (a.id === -1 || b.id === -2) return -1;
			if (b.id === -1 || a.id === -2) return 1;
			return b.id - a.id;
		})
		.map((group) => {
			group.mounts.sort((a, b) =>
				a.name === b.name ? a.id - b.id : a.name < b.name ? -1 : 1,
			);
			return group;
		});
}
