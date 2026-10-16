import type {
	ApplicationEvent,
	EventPayload,
	IEventBus,
} from "../../events/types";
import { NavigationGrid } from "./navigation-grid";
import type {
	INavigable,
	NavDirection,
	NavGrid,
	NavigationMouseTarget,
	NavigationScope,
} from "./types";

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
	private readonly mouseTargets = new Map<string, Set<NavigationMouseTarget>>();
	private active?: string;
	private readonly modals: {
		id: string;
		previous?: string;
		cancel: () => void;
	}[] = [];
	private get modal() {
		return this.modals.at(-1);
	}
	private focused?: INavigable;
	private scope?: NavigationScope;
	private graph = new NavigationGrid([]);
	private readonly directionChanged: (
		this: void,
		payload: EventPayload<"NAV_DIRECTION_CHANGED">,
	) => void = ({ direction, pressed }) =>
		this.focused?.onMove?.(direction, pressed);
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
				if (this.scope) this.scope.cancel();
				else if (this.modal) this.modal.cancel();
				else if (this.active) this.options.get(this.active)?.onCancel?.();
			},
		],
	];
	constructor(
		private readonly events: IEventBus,
		private readonly onActiveChanged?: (active: boolean) => void,
		private readonly onFocusChanged?: (control?: INavigable) => void,
	) {
		events.subscribe("NAV_DIRECTION_CHANGED", this.directionChanged);
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
	setActiveGrid(panelId: string, focusId?: string): void {
		if (this.modal && panelId !== this.modal.id) return;
		if (this.scope && !this.modal && this.active !== panelId) return;
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
		this.refreshGrid(panelId, focusId);
	}
	pushModal(
		id: string,
		grid: NavGrid,
		cancel: () => void,
		focusId?: string,
	): void {
		const existing = this.modals.find((modal) => modal.id === id);
		if (existing) existing.cancel = () => cancel();
		else this.modals.push({ id, previous: this.active, cancel });
		this.registerGrid(id, grid);
		this.setActiveGrid(id);
		if (focusId !== undefined) this.refreshGrid(id, focusId);
	}
	popModal(id: string): void {
		const index = this.modals.findIndex((modal) => modal.id === id);
		const removed = this.modals.at(index);
		if (index < 0 || !removed) return;
		const wasTop = index === this.modals.length - 1;
		this.modals.splice(index, 1);
		for (const modal of this.modals)
			if (modal.previous === id) modal.previous = removed.previous;
		this.unregisterGrid(id);
		if (wasTop && removed.previous) this.setActiveGrid(removed.previous);
	}
	refreshGrid(panelId: string, focusId?: string): void {
		const source = this.grids.get(panelId);
		let grid = typeof source === "function" ? source() : (source ?? []);
		let scope: NavigationScope | undefined;
		for (const row of grid)
			for (const control of row)
				if (control.navigationScope) scope = control.navigationScope;
		if (scope)
			grid = grid.map((row) =>
				row.filter((control) => control.navigationScope === scope),
			);
		const targets = new Set<NavigationMouseTarget>();
		for (const row of grid)
			for (const control of row) {
				const target = control.mouseTarget;
				if (!target) continue;
				targets.add(target);
				target.setNavigationFocus(() => {
					if (this.modal && this.modal.id !== panelId) return;
					this.setActiveGrid(panelId, control.navId);
				});
			}
		for (const target of this.mouseTargets.get(panelId) ?? [])
			if (!targets.has(target)) target.setNavigationFocus(undefined);
		this.mouseTargets.set(panelId, targets);
		if (this.active !== panelId) return;
		this.scope = scope;
		this.graph = new NavigationGrid(grid);
		const id = focusId ?? this.focusedId ?? this.remembered.get(panelId);
		const control = (id ? this.graph.get(id) : undefined) ?? this.graph.first;
		this.setFocus(control, control?.navId === this.focusedId);
		this.onActiveChanged?.(true);
	}
	unregisterGrid(panelId: string): void {
		for (const target of this.mouseTargets.get(panelId) ?? [])
			target.setNavigationFocus(undefined);
		this.mouseTargets.delete(panelId);
		if (this.active === panelId)
			this.options.get(panelId)?.onActiveChanged?.(false);
		this.grids.delete(panelId);
		this.options.delete(panelId);
		const index = this.history.indexOf(panelId);
		if (index >= 0) this.history.splice(index, 1);
		if (this.active !== panelId) return;
		this.setFocus(undefined);
		this.active = undefined;
		this.scope = undefined;
		this.graph = new NavigationGrid([]);
		const previous = this.history.at(-1);
		if (previous) this.setActiveGrid(previous);
		else this.onActiveChanged?.(false);
	}
	private setFocus(control?: INavigable, refresh = false): void {
		if (control === this.focused) {
			// A render may reset styling even when it reuses the focused control.
			control?.onFocus(refresh);
			this.onFocusChanged?.(control);
			return;
		}
		this.focused?.onBlur();
		this.focused = control;
		if (control && this.active) this.remembered.set(this.active, control.navId);
		control?.onFocus(refresh);
		this.onFocusChanged?.(control);
	}
	private move(direction: NavDirection): void {
		if (!this.active) return;
		if (this.focused?.onMove) return;
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
		if (this.active && !this.modal && !this.scope)
			this.options.get(this.active)?.onPanelCycle?.(direction);
	}
	private switchContainer(direction: "left" | "right"): void {
		if (!this.active || this.modal || this.scope) return;
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
		if (this.focused?.onAlternate) this.focused.onAlternate();
		else this.focused?.onInteract();
	}
	destroy(): void {
		for (const targets of this.mouseTargets.values())
			for (const target of targets) target.setNavigationFocus(undefined);
		this.mouseTargets.clear();
		this.events.unsubscribe("NAV_DIRECTION_CHANGED", this.directionChanged);
		this.modals.length = 0;
		for (const [event, handler] of this.handlers)
			this.events.unsubscribe(event, handler);
		this.setFocus(undefined);
		if (this.active) this.options.get(this.active)?.onActiveChanged?.(false);
		this.grids.clear();
		this.options.clear();
		this.history.length = 0;
		this.remembered.clear();
		this.active = undefined;
		this.scope = undefined;
		this.onActiveChanged?.(false);
	}
}
