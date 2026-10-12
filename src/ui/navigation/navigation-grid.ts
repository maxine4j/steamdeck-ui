import type { INavigable, NavDirection, NavGrid } from "./types";

interface GridNode {
	control: INavigable;
	row: number;
	column: number;
	neighbors: Partial<Record<NavDirection, INavigable>>;
}

/** Builds directional edges from logical cells, independent of native frames. */
export class NavigationGrid {
	private readonly nodes = new Map<string, GridNode>();
	constructor(grid: NavGrid) {
		grid.forEach((row, y) => {
			row.forEach((control, x) => {
				if (!control) return;
				if (this.nodes.has(control.navId))
					throw new Error(`Duplicate navigation ID: ${control.navId}`);
				this.nodes.set(control.navId, {
					control,
					row: y,
					column: control.navColumn ?? x,
					neighbors: {},
				});
			});
		});
		for (const node of this.nodes.values()) {
			for (const direction of ["up", "down", "left", "right"] as const) {
				let best: GridNode | undefined;
				let bestAcross = Infinity;
				let bestAlong = Infinity;
				for (const candidate of this.nodes.values()) {
					const dx = candidate.column - node.column;
					const dy = candidate.row - node.row;
					const vertical = direction === "up" || direction === "down";
					const along =
						(vertical ? dy : dx) *
						(direction === "up" || direction === "left" ? -1 : 1);
					const across = Math.abs(vertical ? dx : dy);
					if (along <= 0) continue;
					if (
						across < bestAcross ||
						(across === bestAcross && along < bestAlong)
					) {
						best = candidate;
						bestAcross = across;
						bestAlong = along;
					}
				}
				if (best) node.neighbors[direction] = best.control;
			}
		}
	}
	get first(): INavigable | undefined {
		return this.nodes.values().next().value?.control;
	}
	get(id: string): INavigable | undefined {
		return this.nodes.get(id)?.control;
	}
	neighbor(id: string, direction: NavDirection): INavigable | undefined {
		return this.nodes.get(id)?.neighbors[direction];
	}
}
