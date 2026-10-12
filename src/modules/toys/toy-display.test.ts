import { expect, it } from "vitest";
import type { Toy } from "../../clients/toys-client";
import { groupToys } from "./toy-display";

const toy = (id: number, expansionId?: number, favourite = false): Toy => ({
	id,
	name: `Toy ${id}`,
	icon: 1,
	collected: true,
	favourite,
	expansionId,
});

it("keeps favourites in quick access and their expansion groups", () => {
	const groups = groupToys([
		toy(1, 0, true),
		toy(2, 11, true),
		toy(3, 0),
		toy(4, 10),
		toy(5),
		toy(6, 10),
	]);
	expect(groups.map((group) => group.label)).toEqual([
		"Favourites",
		"Midnight",
		"The War Within",
		"Classic",
		"Unknown expansion",
	]);
	expect(groups.map((group) => group.toys.map((toy) => toy.id))).toEqual([
		[1, 2],
		[2],
		[4, 6],
		[1, 3],
		[5],
	]);
});

it("omits empty groups and sorts toys by name with deterministic ID ties", () => {
	expect(groupToys([])).toEqual([]);
	expect(
		groupToys([
			{ ...toy(3, 12), name: "Z" },
			{ ...toy(2, 12), name: "A" },
			{ ...toy(1, 12), name: "A" },
		]),
	).toEqual([
		{
			id: 12,
			label: "Expansion 12",
			toys: [
				{ ...toy(1, 12), name: "A" },
				{ ...toy(2, 12), name: "A" },
				{ ...toy(3, 12), name: "Z" },
			],
		},
	]);
});
