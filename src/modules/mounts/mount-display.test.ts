import { expect, it } from "vitest";
import type { Mount } from "../../clients/mounts-client";
import { groupMounts } from "./mount-display";

const mount = (id: number, expansionId?: number, favourite = false): Mount => ({
	id,
	index: id,
	name: `Mount ${id}`,
	spell: id,
	icon: id,
	collected: true,
	usable: true,
	favourite,
	expansionId,
});

it("repeats favourites above expansions ordered newest first, retaining missing mounts", () => {
	const missing = { ...mount(3, 0), collected: false };
	const groups = groupMounts([
		mount(1, 0, true),
		mount(2, 11),
		missing,
		mount(4),
	]);
	expect(groups.map((group) => group.label)).toEqual([
		"Favourites",
		"Midnight",
		"Classic",
		"Unknown expansion",
	]);
	expect(groups.map((group) => group.mounts.map((mount) => mount.id))).toEqual([
		[1],
		[2],
		[1, 3],
		[4],
	]);
	expect(groups.at(2)?.mounts).toContain(missing);
	expect(groupMounts([])).toEqual([]);
});

it("sorts each group by name with stable ID ties", () => {
	expect(
		groupMounts([
			{ ...mount(2, 0), name: "A" },
			{ ...mount(1, 0), name: "A" },
			{ ...mount(3, 0), name: "Z" },
		])
			.at(0)
			?.mounts.map((mount) => mount.id),
	).toEqual([1, 2, 3]);
});
