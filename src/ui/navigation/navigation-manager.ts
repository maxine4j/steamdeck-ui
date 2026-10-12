import type { ApplicationEvent, IEventBus } from "../../events/types";
import { NavigationGrid } from "./navigation-grid";
import type { INavigable, NavDirection, NavGrid } from "./types";

type GridSource = NavGrid | (() => NavGrid);
export type GridNeighbors = Partial<Record<NavDirection, string>>;

export interface INavManager {
	registerGrid(
		panelId: string,
		grid: GridSource,
		neighbors?: GridNeighbors,
	): void;
	unregisterGrid(panelId: string): void;
	refreshGrid(panelId: string): void;
	setActiveGrid(panelId: string): void;
	moveUp(): void;
	moveDown(): void;
	moveLeft(): void;
	moveRight(): void;
	interact(): void;
}

export class NavigationManager implements INavManager {
	private readonly grids = new Map<string, GridSource>();
	private readonly neighbors = new Map<string, GridNeighbors>();
	private readonly history: string[] = [];
	private readonly remembered = new Map<string, string>();
	private active?: string;
	private modal?: { id: string; previous?: string; cancel: () => void };
	private focused?: INavigable;
	private graph = new NavigationGrid([]);
	private readonly handlers: [ApplicationEvent, () => void][] = [
		["NAV_UP", () => this.moveUp()],
		["NAV_DOWN", () => this.moveDown()],
		["NAV_LEFT", () => this.moveLeft()],
		["NAV_RIGHT", () => this.moveRight()],
		["NAV_INTERACT", () => this.interact()],
		["NAV_CONTEXT", () => this.focused?.onContext?.()],
		["NAV_ALTERNATE", () => this.focused?.onAlternate?.()],
		["NAV_CANCEL", () => this.modal?.cancel()],
	];
	constructor(
		private readonly events: IEventBus,
		private readonly onActiveChanged?: (active: boolean) => void,
	) {
		for (const [event, handler] of this.handlers)
			events.subscribe(event, handler);
	}
	get focusedId(): string | undefined {
		return this.focused?.navId;
	}
	registerGrid(
		panelId: string,
		grid: GridSource,
		neighbors: GridNeighbors = {},
	): void {
		this.grids.set(panelId, grid);
		this.neighbors.set(panelId, neighbors);
		this.refreshGrid(panelId);
	}
	setActiveGrid(panelId: string): void {
		if (this.modal && panelId !== this.modal.id) return;
		if (!this.grids.has(panelId)) return;
		if (this.active !== panelId) this.setFocus(undefined);
		this.active = panelId;
		const index = this.history.indexOf(panelId);
		if (index >= 0) this.history.splice(index, 1);
		this.history.push(panelId);
		this.refreshGrid(panelId);
	}
	pushModal(id: string, grid: NavGrid, cancel: () => void): void {
		const previous = this.modal?.previous ?? this.active;
		if (this.modal && this.modal.id !== id) this.popModal(this.modal.id);
		this.modal = { id, previous, cancel };
		this.registerGrid(id, grid);
		this.setActiveGrid(id);
	}
	popModal(id: string): void {
		if (this.modal?.id !== id) return;
		const previous = this.modal.previous;
		this.modal = undefined;
		this.unregisterGrid(id);
		if (previous) this.setActiveGrid(previous);
	}
	refreshGrid(panelId: string): void {
		if (this.active !== panelId) return;
		const source = this.grids.get(panelId);
		this.graph = new NavigationGrid(
			typeof source === "function" ? source() : (source ?? []),
		);
		const id = this.focusedId ?? this.remembered.get(panelId);
		this.setFocus((id ? this.graph.get(id) : undefined) ?? this.graph.first);
		this.onActiveChanged?.(this.focused !== undefined);
	}
	unregisterGrid(panelId: string): void {
		this.grids.delete(panelId);
		this.neighbors.delete(panelId);
		const index = this.history.indexOf(panelId);
		if (index >= 0) this.history.splice(index, 1);
		if (this.active !== panelId) return;
		this.setFocus(undefined);
		this.active = undefined;
		this.graph = new NavigationGrid([]);
		const previous = this.history.at(-1);
		if (previous) this.setActiveGrid(previous);
		else this.onActiveChanged?.(false);
	}
	private setFocus(control?: INavigable): void {
		if (control === this.focused) return;
		this.focused?.onBlur();
		this.focused = control;
		if (control && this.active) this.remembered.set(this.active, control.navId);
		control?.onFocus();
	}
	private move(direction: NavDirection): void {
		if (!this.active) return;
		const next = this.focusedId
			? this.graph.neighbor(this.focusedId, direction)
			: undefined;
		if (next) this.setFocus(next);
		else {
			const neighbor = this.neighbors.get(this.active)?.[direction];
			if (neighbor) this.setActiveGrid(neighbor);
		}
	}
	moveUp(): void {
		this.move("up");
	}
	moveDown(): void {
		this.move("down");
	}
	moveLeft(): void {
		this.move("left");
	}
	moveRight(): void {
		this.move("right");
	}
	interact(): void {
		this.focused?.onInteract();
	}
	destroy(): void {
		this.modal = undefined;
		for (const [event, handler] of this.handlers)
			this.events.unsubscribe(event, handler);
		this.setFocus(undefined);
		this.grids.clear();
		this.neighbors.clear();
		this.history.length = 0;
		this.remembered.clear();
		this.active = undefined;
		this.onActiveChanged?.(false);
	}
}
