import type { ApplicationEvent, IEventBus } from "../../events/types";
import { NavigationGrid } from "./navigation-grid";
import type { INavigable, NavDirection, NavGrid } from "./types";

type GridSource = NavGrid | (() => NavGrid);
export type GridNeighbors = Partial<Record<"left" | "right", string>>;
export interface GridOptions extends GridNeighbors {
	onCancel?: () => void;
	onActiveChanged?: (active: boolean) => void;
	onPanelCycle?: (direction: -1 | 1) => void;
}

export interface INavManager {
	registerGrid(panelId: string, grid: GridSource, options?: GridOptions): void;
	unregisterGrid(panelId: string): void;
	refreshGrid(panelId: string, focusId?: string): void;
	setActiveGrid(panelId: string): void;
	moveUp(): void;
	moveDown(): void;
	moveLeft(): void;
	moveRight(): void;
	interact(): void;
}

export class NavigationManager implements INavManager {
	private readonly grids = new Map<string, GridSource>();
	private readonly options = new Map<string, GridOptions>();
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
		["NAV_PANEL_PREVIOUS", () => this.cyclePanel(-1)],
		["NAV_PANEL_NEXT", () => this.cyclePanel(1)],
		["NAV_CONTAINER_LEFT", () => this.switchContainer("left")],
		["NAV_CONTAINER_RIGHT", () => this.switchContainer("right")],
		["NAV_INTERACT", () => this.interact()],
		["NAV_CONTEXT", () => this.focused?.onContext?.()],
		["NAV_ALTERNATE", () => this.focused?.onAlternate?.()],
		[
			"NAV_CANCEL",
			() => {
				if (this.modal) this.modal.cancel();
				else if (this.active) this.options.get(this.active)?.onCancel?.();
			},
		],
	];
	constructor(
		private readonly events: IEventBus,
		private readonly onActiveChanged?: (active: boolean) => void,
		private readonly onFocusChanged?: (control?: INavigable) => void,
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
		options: GridOptions = {},
	): void {
		this.grids.set(panelId, grid);
		this.options.set(panelId, options);
		if (this.active === panelId) options.onActiveChanged?.(true);
		this.refreshGrid(panelId);
	}
	setActiveGrid(panelId: string): void {
		if (this.modal && panelId !== this.modal.id) return;
		if (!this.grids.has(panelId)) return;
		if (this.active !== panelId) {
			this.setFocus(undefined);
			if (this.active) this.options.get(this.active)?.onActiveChanged?.(false);
			this.options.get(panelId)?.onActiveChanged?.(true);
		}
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
	refreshGrid(panelId: string, focusId?: string): void {
		if (this.active !== panelId) return;
		const source = this.grids.get(panelId);
		this.graph = new NavigationGrid(
			typeof source === "function" ? source() : (source ?? []),
		);
		const id = focusId ?? this.focusedId ?? this.remembered.get(panelId);
		this.setFocus((id ? this.graph.get(id) : undefined) ?? this.graph.first);
		this.onActiveChanged?.(true);
	}
	unregisterGrid(panelId: string): void {
		if (this.active === panelId)
			this.options.get(panelId)?.onActiveChanged?.(false);
		this.grids.delete(panelId);
		this.options.delete(panelId);
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
		if (control === this.focused) {
			// A render may reset styling even when it reuses the focused control.
			control?.onFocus();
			this.onFocusChanged?.(control);
			return;
		}
		this.focused?.onBlur();
		this.focused = control;
		if (control && this.active) this.remembered.set(this.active, control.navId);
		control?.onFocus();
		this.onFocusChanged?.(control);
	}
	private move(direction: NavDirection): void {
		if (!this.active) return;
		if (this.focused?.onMove) {
			this.focused.onMove(direction);
			return;
		}
		const next = this.focusedId
			? this.graph.neighbor(this.focusedId, direction)
			: undefined;
		if (
			(direction === "up" || direction === "down") &&
			(!next || next.navigationScroll !== this.focused?.navigationScroll)
		)
			this.focused?.navigationScroll?.scrollToEdge(direction);
		if (next) this.setFocus(next);
	}
	private cyclePanel(direction: -1 | 1): void {
		if (this.active && !this.modal)
			this.options.get(this.active)?.onPanelCycle?.(direction);
	}
	private switchContainer(direction: "left" | "right"): void {
		if (!this.active || this.modal) return;
		const neighbor = this.options.get(this.active)?.[direction];
		if (neighbor) this.setActiveGrid(neighbor);
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
		if (this.active) this.options.get(this.active)?.onActiveChanged?.(false);
		this.grids.clear();
		this.options.clear();
		this.history.length = 0;
		this.remembered.clear();
		this.active = undefined;
		this.onActiveChanged?.(false);
	}
}
