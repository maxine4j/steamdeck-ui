import { expect, it, vi } from "vitest";
import { NavigationGrid } from "./navigation-grid";
import type { INavigable } from "./types";

const node = (navId: string, navColumn = 0): INavigable => ({
	navId,
	navColumn,
	onFocus: vi.fn(),
	onBlur: vi.fn(),
	onInteract: vi.fn(),
});

it("opens a large grid without scanning candidate neighbors and caches moves", () => {
	const rows = Array.from({ length: 100 }, (_, index) => [node(`${index}`)]);
	const scans = vi.spyOn(Map.prototype, "values");
	let openingScans = 0;
	let movementScans = 0;
	let down: INavigable | undefined;
	let repeated: INavigable | undefined;
	let missing: INavigable | undefined;
	try {
		const grid = new NavigationGrid(rows);
		openingScans = scans.mock.calls.length;
		down = grid.neighbor("0", "down");
		repeated = grid.neighbor("0", "down");
		missing = grid.neighbor("0", "up");
		grid.neighbor("0", "up");
		movementScans = scans.mock.calls.length - openingScans;
	} finally {
		scans.mockRestore();
	}
	expect(openingScans).toBe(0);
	expect(movementScans).toBe(2);
	expect(down).toBe(rows.at(1)?.at(0));
	expect(repeated).toBe(down);
	expect(missing).toBeUndefined();
});

it("prefers aligned controls over nearer diagonal controls", () => {
	const origin = node("origin");
	const diagonal = node("diagonal", 1);
	const aligned = node("aligned");
	const grid = new NavigationGrid([[origin], [diagonal], [aligned]]);
	expect(grid.neighbor("origin", "down")).toBe(aligned);
	expect(grid.neighbor("origin", "right")).toBe(diagonal);
	expect(grid.neighbor("aligned", "up")).toBe(origin);
});
