import type {
	Heirloom,
	IHeirloomsClient,
} from "../../clients/heirlooms-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { CollectionView } from "../../ui/collection-view";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import { SCROLL_VIEWPORT_RIGHT } from "../../ui/components/scroll-indicator";
import { SearchFilters } from "../../ui/components/search-filters";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type {
	INavigable,
	NavGrid,
	NavigationChanged,
} from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import { PreparedRanges } from "../../ui/prepared-ranges";

interface Cell {
	readonly border: Frame;
	readonly button: Frame;
	row?: Heirloom;
	top?: number;
	column?: number;
	visible: boolean;
	node?: INavigable;
}
const slots: Record<string, string> = {
	INVTYPE_HEAD: "Head",
	INVTYPE_SHOULDER: "Shoulders",
	INVTYPE_CLOAK: "Back",
	INVTYPE_CHEST: "Chest",
	INVTYPE_ROBE: "Chest",
	INVTYPE_LEGS: "Legs",
	INVTYPE_WEAPON: "Weapons",
	INVTYPE_2HWEAPON: "Weapons",
	INVTYPE_WEAPONMAINHAND: "Weapons",
	INVTYPE_WEAPONOFFHAND: "Weapons",
	INVTYPE_RANGED: "Weapons",
	INVTYPE_RANGEDRIGHT: "Weapons",
	INVTYPE_HOLDABLE: "Weapons",
	INVTYPE_SHIELD: "Weapons",
	INVTYPE_NECK: "Jewellery",
	INVTYPE_FINGER: "Jewellery",
	INVTYPE_TRINKET: "Jewellery",
};
export class HeirloomsPanel implements IPanel {
	readonly id = "heirlooms";
	readonly title = "Heirlooms";
	readonly icon = "Interface\\Icons\\inv_misc_enggizmos_19";
	private readonly frame: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly controls: SearchFilters;
	private readonly view = new CollectionView<Heirloom>(
		(row) => String(row.id),
		(row) => row.displayed,
	);
	private readonly cells = new Map<number, Cell>();
	private readonly headers: Frame[] = [];
	private readonly prepared = new PreparedRanges();
	private grid: NavGrid = [];
	private parent?: Frame;
	private mounted = false;
	private ready = false;
	private complete = false;
	private generation = 0;
	private height = 1;
	private laidOutHeight?: number;
	private cancelLoad?: () => void;
	private cancelRender?: () => void;
	private cancelViewport?: () => void;
	private navigationChanged?: NavigationChanged;
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IHeirloomsClient,
		private readonly scheduler: ITaskScheduler,
		private readonly close: () => void,
	) {
		this.frame = new Frame("heirlooms-root", pool);
		this.viewport = new Frame("heirlooms-scroll", pool, "ScrollFrame");
		this.content = new Frame("heirlooms-content", pool);
		this.controls = new SearchFilters(
			this.id,
			pool,
			(text) => {
				this.client.search(text);
				this.refresh();
			},
			scheduler,
			(focus) => this.navigationChanged?.(focus),
		);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Heirlooms requires a frame parent");
		this.parent = parent;
		this.mounted = true;
		if (this.client.isInCombat()) return;
		this.ready = true;
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.frame.setLabel(
			"actions",
			`${controllerIcon("X")} Create Heirloom`,
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.frame.show();
		this.controls.mount(this.frame);
		this.viewport.inset(this.frame, 16, 104, SCROLL_VIEWPORT_RIGHT, 48);
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.onVerticalScroll(() => this.requestViewport());
		this.viewport.onSizeChanged(() => {
			if (this.mounted) {
				this.viewport.clampScroll();
				this.requestViewport();
			}
		});
		this.viewport.show();
		this.content.show();
		this.refresh();
	}
	refresh(): void {
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.cancelViewport?.();
		this.cancelViewport = undefined;
		const generation = ++this.generation;
		for (const cell of this.cells.values()) cell.node = undefined;
		this.complete = false;
		this.prepared.reset();
		if (!this.mounted || !this.ready || this.client.isInCombat()) return;
		this.controls.setOptions(
			this.client.getFilters().map((filter) => ({
				...filter,
				activate: () => {
					if (this.mounted && !this.client.isInCombat()) {
						this.client.toggleFilter(filter.id);
						this.refresh();
					}
				},
			})),
		);
		this.loading("Loading heirlooms...");
		this.cancelLoad = this.client.load(
			(rows, complete) => {
				if (!this.current(generation)) return;
				this.view.replace(rows);
				this.complete = complete;
				this.render();
			},
			(done, total) => {
				if (this.current(generation))
					this.loading(`Loading heirlooms... ${done} / ${total}`);
			},
			(rows, complete) => {
				if (!this.current(generation)) return;
				const changed = this.view.update(rows);
				const finished = this.complete !== complete;
				this.complete = complete;
				if (changed || finished) this.render();
			},
		);
	}
	private current(generation: number): boolean {
		return this.mounted && this.ready && generation === this.generation;
	}
	private loading(text: string): void {
		this.frame.setLabel("loading", text, "BOTTOMRIGHT", -16, 16, 12);
	}
	private requestViewport(): void {
		if (
			!this.mounted ||
			this.cancelViewport ||
			this.cancelRender ||
			this.client.isInCombat() ||
			this.prepared.includes(this.viewport.getVisibleVerticalRange())
		)
			return;
		this.cancelViewport = this.scheduler.nextFrame(() => {
			this.cancelViewport = undefined;
			if (this.mounted) this.render();
		});
	}
	private render(): void {
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.prepared.reset();
		if (!this.mounted || this.client.isInCombat()) return;
		const generation = this.generation;
		const range = this.viewport.getVisibleVerticalRange();
		const first = range.top - 92,
			last = range.bottom + Math.max(92, range.bottom - range.top);
		const groups = new Map<string, Heirloom[]>();
		for (const row of this.view.values()) {
			const label = slots[row.equipLocation] ?? "Other";
			const group = groups.get(label) ?? [];
			group.push(row);
			groups.set(label, group);
		}
		const ordered = [...groups.entries()].sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0,
		);
		const grid: NavGrid = [],
			wanted = new Set<number>(),
			jobs: (() => void)[] = [];
		let top = 0;
		ordered.forEach(([label, rows], groupIndex) => {
			rows.sort((a, b) =>
				a.name === b.name ? a.id - b.id : a.name < b.name ? -1 : 1,
			);
			const headerTop = top;
			jobs.push(() => {
				let header = this.headers.at(groupIndex);
				if (!header) {
					header = new Frame(`heirloom-header-${groupIndex}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(460, 24, "TOPLEFT", this.content, 0, -headerTop);
				header.setLabel(
					"title",
					`${label} (${rows.filter((row) => row.collected).length} / ${rows.length})`,
					"LEFT",
					0,
					0,
					15,
					460,
				);
				header.show();
			});
			const firstRow = grid.length;
			for (let index = 0; index < Math.ceil(rows.length / 10); index++)
				grid.push([]);
			rows.forEach((row, index) => {
				const cellTop = top + 28 + Math.floor(index / 10) * 46,
					column = index % 10;
				const existing = this.cells.get(row.id);
				const navRow = grid.at(firstRow + Math.floor(index / 10));
				const nearby = cellTop + 42 >= first && cellTop <= last;
				const reusable =
					existing?.visible &&
					existing.row === row &&
					existing.top === cellTop &&
					existing.column === column &&
					existing.node;
				if (!nearby && !reusable) return;
				wanted.add(row.id);
				if (reusable && existing?.node) {
					navRow?.push(existing.node);
					return;
				}
				jobs.push(() => {
					if (this.view.get(String(row.id)) !== row) return;
					let cell = this.cells.get(row.id);
					if (!cell) {
						cell = {
							border: new Frame(`heirloom-border-${row.id}`, this.pool),
							button: new Frame(`heirloom-item-${row.id}`, this.pool, "Button"),
							visible: true,
						};
						this.cells.set(row.id, cell);
					}
					cell.row = row;
					cell.top = cellTop;
					cell.column = column;
					cell.visible = true;
					cell.border.setParent(this.content);
					cell.border.layout(
						42,
						42,
						"TOPLEFT",
						this.content,
						column * 46,
						-cellTop,
					);
					cell.border.setColor(
						row.collected ? 0.3 : 0.12,
						row.collected ? 0.34 : 0.12,
						row.collected ? 0.42 : 0.12,
					);
					cell.button.setParent(cell.border);
					cell.button.layout(38, 38, "CENTER", cell.border);
					cell.button.setIcon(row.icon);
					cell.button.setLabel(
						"level",
						row.collected && row.maxLevel > 0 ? String(row.maxLevel) : "",
						"BOTTOMRIGHT",
						-1,
						1,
						10,
					);
					cell.button.setBackgroundOpacity(row.collected ? 1 : 0.2);
					const current = () =>
						this.current(generation) &&
						cell?.visible &&
						this.view.get(String(row.id)) === row;
					const create = () => {
						if (current() && row.collected) this.client.create(row.id);
					};
					cell.button.setHoverTooltip(() =>
						current() ? { item: row.link ?? row.id } : undefined,
					);
					cell.button.onClick((click) => {
						if (click === "LeftButton") create();
					});
					cell.node = {
						...cell.button.navigationNode(`heirloom-${row.id}`, create, () => {
							if (current()) {
								this.viewport.revealVerticalRange(
									cellTop,
									cellTop + 42,
									this.height,
								);
								this.frame.setLabel(
									"details",
									`${row.name} · Upgrade ${row.upgradeLevel} · Level ${row.maxLevel}`,
									"BOTTOMLEFT",
									16,
									36,
									12,
								);
							}
						}),
						navColumn: column,
						onAlternate: create,
						tooltipItem: () =>
							current() ? { item: row.link ?? row.id } : undefined,
						navigationScroll: {
							scrollToEdge: (direction) => {
								if (this.complete && !this.cancelRender)
									this.viewport.scrollToEdge(direction);
							},
						},
					};
					navRow?.push(cell.node);
					navRow?.sort((a, b) => (a.navColumn ?? 0) - (b.navColumn ?? 0));
					cell.border.show();
					cell.button.show();
				});
			});
			top += 28 + Math.ceil(rows.length / 10) * 46 + 14;
		});
		for (const [id, cell] of this.cells)
			if (cell.visible && !wanted.has(id))
				jobs.push(() => {
					cell.visible = false;
					cell.border.hide();
					cell.button.hide();
				});
		for (const header of this.headers.slice(ordered.length))
			jobs.push(() => header.hide());
		this.height = Math.max(1, top);
		if (this.height !== this.laidOutHeight) {
			this.content.layout(460, this.height, "TOPLEFT", this.viewport);
			this.laidOutHeight = this.height;
			this.viewport.clampScroll();
		}
		this.content.setLabel(
			"empty",
			this.complete && ordered.length === 0 ? "No heirlooms to display" : "",
			"TOPLEFT",
			0,
			-10,
		);
		let cursor = 0;
		const step = () => {
			this.cancelRender = undefined;
			if (!this.current(generation) || this.client.isInCombat()) return;
			const end = Math.min(jobs.length, cursor + 10);
			while (cursor < end) jobs.at(cursor++)?.();
			this.grid = grid.filter((row) => row.length > 0);
			this.navigationChanged?.();
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
			else {
				this.loading(this.complete ? "" : "Loading heirlooms...");
				this.prepared.remember(first, last);
			}
		};
		step();
	}
	resume(): void {
		if (!this.mounted || this.client.isInCombat()) return;
		if (!this.ready && this.parent) this.onMount(this.parent);
		else this.render();
	}
	setNavigationChanged(callback?: NavigationChanged): void {
		this.navigationChanged = callback;
	}
	getNavGrid(): NavGrid {
		return this.mounted && this.ready
			? [
					...this.controls.getNavGrid(),
					...(this.controls.isOpen() ? [] : this.grid),
				]
			: [];
	}
	onContainerClosed(): void {
		this.close();
	}
	onUnmount(): void {
		this.mounted = false;
		this.ready = false;
		this.generation++;
		for (const cell of this.cells.values()) cell.node = undefined;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.cancelViewport?.();
		this.cancelViewport = undefined;
		this.controls.hide();
		this.viewport.onVerticalScroll();
		this.viewport.onSizeChanged();
		this.frame.hide();
	}
	destroy(): void {
		this.onUnmount();
		this.controls.destroy();
		for (const cell of this.cells.values()) {
			cell.button.destroy();
			cell.border.destroy();
		}
		for (const header of this.headers) header.destroy();
		this.content.destroy();
		this.viewport.destroy();
		this.frame.destroy();
	}
}
