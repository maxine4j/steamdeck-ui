import type {
	Appearance,
	IAppearancesClient,
} from "../../clients/appearances-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { CollectionView } from "../../ui/collection-view";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import { SCROLL_VIEWPORT_RIGHT } from "../../ui/components/scroll-indicator";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type {
	INavigable,
	NavGrid,
	NavigationScroll,
} from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import { PreparedRanges } from "../../ui/prepared-ranges";
import { expansionNames } from "../expansion-names";

interface Cell {
	readonly border: Frame;
	readonly button: Frame;
	row?: Appearance;
	top?: number;
	column?: number;
	visible: boolean;
	node?: INavigable;
}
interface SlotView {
	readonly content: Frame;
	readonly view: CollectionView<Appearance>;
	readonly cells: Map<number, Cell>;
	readonly headers: Frame[];
	grid: NavGrid;
	height: number;
	laidOutHeight?: number;
	groups?: [number, Appearance[]][];
	readonly preparedRanges: PreparedRanges;
}

const columns = 10;
const spacing = 46;
const modelHeight = 364;
const slotRows = [[1, 10], [3, 6], [15, 7], [5, 8], [4], [19], [9], [16, 17]];
function slotPosition(id: number): { row: number; column: number } {
	const row = slotRows.findIndex((slots) => slots.includes(id));
	return { row, column: slotRows.at(row)?.indexOf(id) ?? 0 };
}

export class AppearancesPanel implements IPanel {
	readonly id = "appearances";
	readonly title = "Appearances";
	readonly iconAtlas = "transmog-icon-ui";
	private readonly frame: Frame;
	private readonly body: Frame;
	private readonly model: Frame;
	private readonly back: Frame;
	private readonly clear: Frame;
	private readonly current: Frame;
	private readonly viewport: Frame;
	private readonly slotButtons = new Map<number, Frame>();
	private readonly views = new Map<number, SlotView>();
	private mounted = false;
	private initialized = false;
	private slot?: number;
	private complete = false;
	private generation = 0;
	private cancelLoad?: () => void;
	private cancelRender?: () => void;
	private cancelViewport?: () => void;
	private navigationChanged?: (focusId?: string) => void;
	private readonly navigationScroll: NavigationScroll = {
		scrollToEdge: (direction) => {
			if (this.complete && !this.cancelRender)
				this.viewport.scrollToEdge(direction);
		},
	};
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IAppearancesClient,
		private readonly scheduler: ITaskScheduler,
		private readonly close: () => void,
	) {
		this.frame = new Frame("appearances-root", pool);
		this.body = new Frame("appearances-slots", pool);
		this.model = new Frame("appearances-model", pool, "DressUpModel");
		this.back = new Frame("appearances-back", pool, "Button");
		this.clear = new Frame("appearances-clear", pool, "Button");
		this.current = new Frame("appearances-current", pool, "Button");
		this.viewport = new Frame("appearances-scroll", pool, "ScrollFrame");
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Appearances requires a frame parent");
		this.mounted = true;
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.frame.show();
		this.body.setParent(this.frame);
		this.body.layout(500, 420, "TOP", this.frame, 0, -80);
		this.body.show();
		this.model.setParent(this.frame);
		this.model.show();
		this.button(this.back, "‹ Back", 96, "TOPLEFT", 16, () => this.onBack());
		this.button(this.clear, "Clear Appearance", 140, "TOPRIGHT", -180, () =>
			this.clearAppearance(),
		);
		this.button(this.current, "Current Appearance", 156, "TOPRIGHT", -16, () =>
			this.currentAppearance(),
		);
		for (const slot of this.client.getSlots()) {
			let button = this.slotButtons.get(slot.id);
			if (!button) {
				button = new Frame(`appearance-slot-${slot.id}`, this.pool, "Button");
				this.slotButtons.set(slot.id, button);
				button.setParent(this.body);
				button.setIcon(slot.icon);
				button.setTooltip(slot.name);
				button.onClick((click) => {
					if (click === "LeftButton") this.openSlot(slot.id);
				});
				const { row, column } = slotPosition(slot.id);
				const weapon = row === 7;
				button.layout(
					40,
					40,
					"TOPLEFT",
					this.body,
					weapon ? 107 + column * 242 : 16 + column * 422,
					-row * spacing,
				);
			}
		}
		if (!this.initialized) {
			this.model.setModelUnit("player");
			this.initialized = true;
		}
		this.layout();
	}
	private button(
		frame: Frame,
		label: string,
		width: number,
		point: string,
		x: number,
		activate: () => void,
	): void {
		frame.setParent(this.frame);
		frame.layout(width, 26, point, this.frame, x, -42);
		frame.setButtonBackground();
		frame.setLabel("label", label, "CENTER", 0, 0, 13);
		frame.onClick((click) => {
			if (click === "LeftButton" && this.mounted) activate();
		});
		frame.show();
	}
	private layout(): void {
		const browsing = this.slot !== undefined;
		this.model.layout(
			332,
			modelHeight * (browsing ? 0.7 : 1),
			"TOP",
			this.frame,
			0,
			-80,
		);
		for (const button of this.slotButtons.values()) {
			if (browsing) button.hide();
			else button.show();
		}
		if (browsing) this.back.show();
		else this.back.hide();
		this.frame.setLabel(
			"actions",
			`${controllerIcon("X")} ${browsing ? "Preview" : "Open Slot"}`,
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		if (!browsing) this.viewport.hide();
	}
	private openSlot(slot: number): void {
		if (!this.mounted || this.slot === slot) return;
		this.detach();
		this.slot = slot;
		this.complete = false;
		let state = this.views.get(slot);
		if (!state) {
			state = {
				content: new Frame(`appearances-content-${slot}`, this.pool),
				view: new CollectionView(
					(row: Appearance) => String(row.id),
					() => true,
				),
				cells: new Map(),
				headers: [],
				grid: [],
				height: 1,
				preparedRanges: new PreparedRanges(),
			};
			this.views.set(slot, state);
		}
		const view = state;
		this.layout();
		this.viewport.inset(
			this.frame,
			16,
			80 + modelHeight * 0.7 + 16,
			SCROLL_VIEWPORT_RIGHT,
			48,
		);
		view.content.setParent(this.viewport);
		this.viewport.setScrollContent(view.content);
		this.viewport.onSizeChanged(() => {
			if (this.mounted && this.slot === slot) {
				this.layoutContent(view);
				this.viewport.clampScroll();
				this.requestViewportRender(view, slot, this.generation);
			}
		});
		this.viewport.onVerticalScroll(() =>
			this.requestViewportRender(view, slot, this.generation),
		);
		this.viewport.show();
		view.content.show();
		this.frame.setLabel(
			"loading",
			"Loading appearances...",
			"BOTTOMRIGHT",
			-16,
			16,
			12,
		);
		const generation = this.generation;
		this.navigationChanged?.("appearances-back");
		this.cancelLoad = this.client.load(
			slot,
			(rows, complete) => {
				if (!this.mounted || generation !== this.generation) return;
				view.view.replace(rows);
				this.invalidate(view);
				this.complete = complete;
				this.render(view, slot, generation);
			},
			(completed, total) => {
				if (this.mounted && generation === this.generation)
					this.frame.setLabel(
						"loading",
						`Loading appearances... ${completed} / ${total}`,
						"BOTTOMRIGHT",
						-16,
						16,
						12,
					);
			},
			(rows, complete) => {
				if (!this.mounted || generation !== this.generation) return;
				const changed = view.view.update(rows);
				const finished = this.complete !== complete;
				this.complete = complete;
				if (changed || finished) {
					this.invalidate(view);
					this.render(view, slot, generation);
				}
			},
		);
	}
	private layoutContent(view: SlotView): void {
		if (view.laidOutHeight === view.height) return;
		view.content.layout(460, view.height, "TOPLEFT", this.viewport);
		view.laidOutHeight = view.height;
		this.viewport.clampScroll();
	}
	private invalidate(view: SlotView): void {
		view.groups = undefined;
		view.preparedRanges.reset();
		this.cancelViewport?.();
		this.cancelViewport = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
	}
	private requestViewportRender(
		view: SlotView,
		slot: number,
		generation: number,
	): void {
		if (
			!this.mounted ||
			this.slot !== slot ||
			generation !== this.generation ||
			this.cancelViewport ||
			this.cancelRender ||
			view.preparedRanges.includes(this.viewport.getVisibleVerticalRange())
		)
			return;
		this.cancelViewport = this.scheduler.nextFrame(() => {
			this.cancelViewport = undefined;
			if (
				this.mounted &&
				this.slot === slot &&
				generation === this.generation &&
				!this.cancelRender &&
				!view.preparedRanges.includes(this.viewport.getVisibleVerticalRange())
			)
				this.render(view, slot, generation);
		});
	}
	private render(view: SlotView, slot: number, generation: number): void {
		const range = this.viewport.getVisibleVerticalRange();
		const firstVisible = range.top - 2 * spacing;
		const lastVisible =
			range.bottom + Math.max(2 * spacing, range.bottom - range.top);
		if (!view.groups) {
			const groups = new Map<number, Appearance[]>();
			for (const row of view.view.values()) {
				const key = row.expansionId ?? -1;
				let group = groups.get(key);
				if (!group) {
					group = [];
					groups.set(key, group);
				}
				group.push(row);
			}
			view.groups = [...groups.entries()].sort(([a], [b]) => b - a);
			for (const [, rows] of view.groups)
				rows.sort((a, b) =>
					a.name === b.name ? a.id - b.id : a.name < b.name ? -1 : 1,
				);
		}
		const ordered = view.groups;
		const jobs: (() => void)[] = [];
		const wanted = new Set<number>();
		const grid: NavGrid = [];
		let top = 0;
		ordered.forEach(([expansion, rows], groupIndex) => {
			const headerTop = top;
			jobs.push(() => {
				let header = view.headers.at(groupIndex);
				if (!header) {
					header = new Frame(
						`appearance-header-${slot}-${groupIndex}`,
						this.pool,
					);
					view.headers.push(header);
				}
				header.setParent(view.content);
				header.layout(460, 24, "TOPLEFT", view.content, 0, -headerTop);
				header.setLabel(
					"title",
					`${expansion < 0 ? "Unknown expansion" : (expansionNames.at(expansion) ?? `Expansion ${expansion}`)} (${rows.filter((row) => row.collected).length} / ${rows.length})`,
					"LEFT",
					0,
					0,
					15,
					460,
				);
				header.show();
			});
			const firstRow = grid.length;
			for (let index = 0; index < Math.ceil(rows.length / columns); index++)
				grid.push([]);
			rows.forEach((row, index) => {
				const cellTop = top + 28 + Math.floor(index / columns) * spacing;
				const column = index % columns;
				const navRow = grid.at(firstRow + Math.floor(index / columns));
				const existing = view.cells.get(row.id);
				const ready =
					existing?.visible &&
					existing.node &&
					existing.row === view.view.get(String(row.id)) &&
					existing.top === cellTop &&
					existing.column === column;
				const nearby = cellTop + 42 >= firstVisible && cellTop <= lastVisible;
				if (!nearby && !ready) return;
				wanted.add(row.id);
				if (ready && existing?.node) {
					navRow?.push(existing.node);
					return;
				}
				jobs.push(() => {
					if (view.view.get(String(row.id)) !== row) return;
					let cell = view.cells.get(row.id);
					if (!cell) {
						cell = {
							border: new Frame(
								`appearance-border-${slot}-${row.id}`,
								this.pool,
							),
							button: new Frame(
								`appearance-item-${slot}-${row.id}`,
								this.pool,
								"Button",
							),
							visible: false,
						};
						view.cells.set(row.id, cell);
					}
					cell.row = row;
					cell.top = cellTop;
					cell.column = column;
					cell.visible = true;
					cell.border.setParent(view.content);
					cell.border.layout(
						42,
						42,
						"TOPLEFT",
						view.content,
						column * spacing,
						-cellTop,
					);
					if (row.collected) cell.border.setColor(0.3, 0.34, 0.42);
					else cell.border.setColor(0.12, 0.12, 0.12);
					cell.button.setParent(cell.border);
					cell.button.layout(38, 38, "CENTER", cell.border);
					cell.button.setIcon(row.icon);
					cell.button.setOpacity(row.collected ? 1 : 0.2);
					const current = () =>
						this.mounted &&
						this.slot === slot &&
						cell?.visible &&
						view.view.get(String(row.id)) === row;
					const preview = () => {
						if (current())
							this.model.tryOnModel(
								row.sourceId,
								slot === 17
									? "SecondaryHandSlot"
									: slot === 16
										? "MainHandSlot"
										: undefined,
							);
					};
					cell.button.setTooltip(
						row.name,
						`item:${row.itemId}`,
						false,
						(hovered) => {
							if (hovered) preview();
						},
					);
					cell.button.onClick((click) => {
						if (click === "LeftButton") preview();
					});
					const node = cell.button.navigationNode(
						`appearance-item-${slot}-${row.id}`,
						preview,
						() => {
							if (current()) {
								this.viewport.revealVerticalRange(
									cellTop,
									cellTop + 42,
									view.height,
								);
								preview();
							}
						},
					);
					cell.node = {
						...node,
						navColumn: column,
						onAlternate: preview,
						tooltipItem: () => (current() ? { item: row.itemId } : undefined),
						navigationScroll: this.navigationScroll,
					};
					navRow?.push(cell.node);
					navRow?.sort((a, b) => (a.navColumn ?? 0) - (b.navColumn ?? 0));
					cell.border.show();
					cell.button.show();
				});
			});
			top += 28 + Math.ceil(rows.length / columns) * spacing + 14;
		});
		for (const [id, cell] of view.cells)
			if (cell.visible && !wanted.has(id))
				jobs.push(() => {
					cell.visible = false;
					cell.border.hide();
					cell.button.hide();
				});
		for (const header of view.headers.slice(ordered.length))
			jobs.push(() => header.hide());
		view.height = Math.max(1, top);
		this.layoutContent(view);
		view.content.setLabel(
			"empty",
			this.complete && ordered.length === 0 ? "No appearances to display" : "",
			"TOPLEFT",
			0,
			-10,
		);
		let cursor = 0;
		const step = () => {
			if (!this.mounted || generation !== this.generation) return;
			this.cancelRender = undefined;
			const end = Math.min(jobs.length, cursor + 10);
			while (cursor < end) jobs.at(cursor++)?.();
			view.grid = grid.filter((row) => row.length > 0);
			this.navigationChanged?.();
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
			else
				this.frame.setLabel(
					"loading",
					this.complete ? "" : "Loading appearances...",
					"BOTTOMRIGHT",
					-16,
					16,
					12,
				);
			if (cursor === jobs.length) {
				view.preparedRanges.remember(firstVisible, lastVisible);
				this.requestViewportRender(view, slot, generation);
			}
		};
		step();
	}
	private clearAppearance(): void {
		if (this.mounted) this.model.undressModel();
	}
	private currentAppearance(): void {
		if (this.mounted) this.model.setModelUnit("player");
	}
	private detach(): void {
		this.generation++;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.cancelViewport?.();
		this.cancelViewport = undefined;
		this.viewport.onVerticalScroll();
		this.viewport.onSizeChanged();
		if (this.slot !== undefined) this.views.get(this.slot)?.content.hide();
	}
	onBack(): void {
		if (!this.mounted) return;
		if (this.slot === undefined) {
			this.close();
			return;
		}
		const previous = this.slot;
		this.detach();
		this.slot = undefined;
		this.frame.setLabel("loading", "", "BOTTOMRIGHT", -16, 16, 12);
		this.layout();
		this.navigationChanged?.(`appearance-slot-${previous}`);
	}
	onUnmount(): void {
		this.detach();
		this.slot = undefined;
		this.mounted = false;
		this.frame.hide();
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
		this.navigationChanged = callback;
	}
	getNavGrid(): NavGrid {
		if (!this.mounted) return [];
		const actions = [
			this.clear.navigationNode("appearances-clear", () =>
				this.clearAppearance(),
			),
			this.current.navigationNode("appearances-current", () =>
				this.currentAppearance(),
			),
		];
		if (this.slot !== undefined)
			return [
				[
					this.back.navigationNode("appearances-back", () => this.onBack()),
					...actions,
				],
				...(this.views.get(this.slot)?.grid ?? []),
			];
		const rows: NavGrid = [];
		for (const slot of this.client.getSlots()) {
			const position = slotPosition(slot.id);
			while (rows.length <= position.row) rows.push([]);
			const row = rows.at(position.row);
			const button = this.slotButtons.get(slot.id);
			if (button)
				row?.push({
					...button.navigationNode(`appearance-slot-${slot.id}`, () =>
						this.openSlot(slot.id),
					),
					navColumn: position.column,
					onAlternate: () => this.openSlot(slot.id),
				});
		}
		return [actions, ...rows.filter((row) => row.length > 0)];
	}
	destroy(): void {
		this.onUnmount();
		for (const view of this.views.values()) {
			for (const cell of view.cells.values()) {
				cell.button.destroy();
				cell.border.destroy();
			}
			for (const header of view.headers) header.destroy();
			view.content.destroy();
		}
		for (const button of this.slotButtons.values()) button.destroy();
		for (const frame of [
			this.model,
			this.body,
			this.back,
			this.clear,
			this.current,
			this.viewport,
			this.frame,
		])
			frame.destroy();
	}
}
