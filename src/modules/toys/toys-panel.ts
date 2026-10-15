import {
	type IPerformanceClient,
	quietPerformance,
	WorkMeasurement,
} from "../../clients/performance-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IToysClient, Toy } from "../../clients/toys-client";
import { toysConfig } from "../../clients/toys-config";
import { CollectionView } from "../../ui/collection-view";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import { SearchFilters } from "../../ui/components/search-filters";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid, NavigationScroll } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import type { IToyActionMenu } from "./toy-action-menu";
import { groupToys, type ToyGroup } from "./toy-display";

const columns = 10;
const spacing = 46;
interface ToyCell {
	navId?: string;
	key?: string;
	toy?: Toy;
	source?: Toy;
	top?: number;
	column?: number;
	visible?: boolean;
	readonly border: Frame;
	readonly favourite: Frame;
	readonly icon: Frame;
	readonly cooldown: Frame;
}

export class ToysPanel implements IPanel {
	readonly id = "toys";
	readonly title = "Toys";
	readonly icon = 454046;
	private readonly frame: Frame;
	private readonly controls: SearchFilters;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly loadingTrack: Frame;
	private readonly loadingProgress: Frame;
	private readonly cells: ToyCell[] = [];
	private readonly cellsById = new Map<string, ToyCell>();
	private readonly headers: Frame[] = [];
	private groups?: ToyGroup[];
	private readonly view = new CollectionView<Toy>(
		(row) => String(row.id),
		(row) => row.displayed !== false,
	);
	private renderPending = false;
	private renderMeasurement?: WorkMeasurement;
	private mounted = false;
	private parent?: Frame;
	private mountPending = false;
	private dirty = true;
	private snapshotComplete = false;
	private viewComplete = false;
	private generation = 0;
	private renderGeneration = 0;
	private cancelLoad?: () => void;
	private cancelRender?: () => void;
	private cancelViewport?: () => void;
	private preparedRanges: { top: number; bottom: number }[] = [];
	private cancelCooldown?: () => void;
	private repeatCooldown = false;
	private grid: NavGrid = [];
	private visibleIds = new Set<string>();
	private contentHeight = 1;
	private laidOutHeight?: number;
	private navigationChanged?: (focusId?: string) => void;
	private readonly navigationScroll: NavigationScroll = {
		scrollToEdge: (direction: "up" | "down") => {
			if (this.viewComplete && !this.cancelRender)
				this.viewport.scrollToEdge(direction);
		},
	};
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IToysClient,
		private readonly menu: IToyActionMenu,
		private readonly scheduler: ITaskScheduler,
		private readonly close: () => void,
		private readonly performance: IPerformanceClient = quietPerformance,
	) {
		this.frame = new Frame("toys-root", pool);
		this.controls = new SearchFilters(
			"toys",
			pool,
			(text) => {
				if (this.mounted && !this.client.isInCombat()) {
					this.client.search(text);
					this.refresh();
				}
			},
			scheduler,
			(focusId) => this.navigationChanged?.(focusId),
		);
		this.viewport = new Frame("toys-scroll", pool, "ScrollFrame");
		this.content = new Frame("toys-content", pool);
		this.loadingTrack = new Frame("toys-loading-track", pool);
		this.loadingProgress = new Frame("toys-loading-progress", pool);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Toys requires a frame parent");
		this.parent = parent;
		this.mounted = true;
		this.mountPending = this.client.isInCombat();
		if (this.mountPending) return;
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.frame.setLabel(
			"actions",
			`${controllerIcon("X")} Use   ${controllerIcon("Y")} Actions`,
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.frame.show();
		this.controls.mount(this.frame);
		this.viewport.inset(this.frame, 16, 104, 16, 48);
		this.viewport.onSizeChanged(() => {
			if (this.mounted) {
				this.layoutContent();
				this.viewport.clampScroll();
				this.requestViewportRender();
			}
		});
		this.viewport.onVerticalScroll(() => this.requestViewportRender());
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.mounted = true;
		this.refresh();
		this.refreshCooldowns();
	}
	refresh(): void {
		this.renderMeasurement?.finish("cancelled refresh");
		this.renderMeasurement = undefined;
		this.snapshotComplete = false;
		this.viewComplete = false;
		this.dirty = true;
		const generation = ++this.generation;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.renderPending = false;
		this.menu.close();
		// Retain logical navigation while waiting for a replacement snapshot.
		// Existing action callbacks are invalidated by the load generation.
		this.navigationChanged?.();
		if (!this.mounted || this.client.isInCombat()) return;
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
		this.frame.setLabel(
			"loading",
			"Loading toys...",
			"BOTTOMRIGHT",
			-16,
			16,
			12,
		);
		this.loadingTrack.setParent(this.frame);
		this.loadingTrack.layout(140, 4, "BOTTOMRIGHT", this.frame, -16, 8);
		this.loadingTrack.setColor(0.12, 0.12, 0.12);
		this.loadingProgress.setParent(this.loadingTrack);
		this.loadingProgress.setColor(1, 0.82, 0);
		this.loadingTrack.show();
		this.setLoadingProgress(0);
		this.cancelLoad = this.client.load(
			(toys, complete = true) => {
				if (!this.mounted || generation !== this.generation) return;
				this.snapshotComplete = complete;
				this.dirty = true;
				this.viewComplete = false;
				this.view.replace(toys);
				this.groups = undefined;
				this.preparedRanges = [];
				if (
					this.cancelRender &&
					this.cells.some(
						(cell) =>
							cell.visible &&
							cell.toy &&
							cell.source !== this.view.get(String(cell.toy.id)),
					)
				)
					this.navigationChanged?.();
				if (!this.client.isInCombat()) this.requestRender(generation);
			},
			(completed, total) => {
				if (!this.mounted || generation !== this.generation) return;
				// Scanning and rendering each occupy half the bar. These are work
				// fractions, not an estimate of elapsed time.
				this.setLoadingProgress(total === 0 ? 0.5 : (completed / total) * 0.5);
			},
			(changes, complete) => {
				if (!this.mounted || generation !== this.generation) return;
				const changed = this.view.update(changes);
				if (changed) {
					this.groups = undefined;
					this.preparedRanges = [];
				}
				if (
					changed &&
					changes.some((row) => {
						const source = this.view.get(String(row.id));
						const ordinary = this.cellsById.get(`toy-${row.id}`);
						const favourite = this.cellsById.get(`toy-favourite-${row.id}`);
						return (
							(ordinary?.visible && ordinary.source !== source) ||
							(favourite?.visible && favourite.source !== source)
						);
					})
				)
					this.navigationChanged?.();
				const finished = complete !== this.snapshotComplete;
				this.snapshotComplete = complete;
				if (!changed && !finished) return;
				this.dirty = true;
				this.viewComplete = false;
				if (!this.client.isInCombat()) this.requestRender(generation);
			},
		);
	}
	private setLoadingProgress(progress: number): void {
		if (progress <= 0) this.loadingProgress.hide();
		else {
			this.loadingProgress.layout(
				140 * Math.min(1, progress),
				4,
				"TOPLEFT",
				this.loadingTrack,
			);
			this.loadingProgress.show();
		}
	}
	private requestRender(generation: number): void {
		if (this.cancelRender) {
			this.renderPending = true;
			return;
		}
		this.render(generation, this.snapshotComplete);
	}
	private requestViewportRender(): void {
		if (!this.mounted) return;
		if (this.isViewportPrepared()) return;
		if (this.cancelViewport || this.cancelRender || this.client.isInCombat())
			return;
		this.cancelViewport = this.scheduler.nextFrame(() => {
			this.cancelViewport = undefined;
			if (
				this.mounted &&
				!this.client.isInCombat() &&
				!this.cancelRender &&
				!this.isViewportPrepared()
			)
				this.render(this.generation, this.snapshotComplete);
		});
	}
	private isViewportPrepared(): boolean {
		const range = this.viewport.getVisibleVerticalRange();
		return this.preparedRanges.some(
			(prepared) =>
				range.top >= prepared.top && range.bottom <= prepared.bottom,
		);
	}
	private rememberPreparedRange(top: number, bottom: number): void {
		const retained: { top: number; bottom: number }[] = [];
		for (const range of this.preparedRanges) {
			if (range.bottom < top || range.top > bottom) retained.push(range);
			else {
				top = Math.min(top, range.top);
				bottom = Math.max(bottom, range.bottom);
			}
		}
		retained.push({ top, bottom });
		this.preparedRanges = retained;
	}
	private render(generation: number, complete = true): void {
		const measurement = new WorkMeasurement(
			this.performance,
			"toys render",
			"cache-update",
		);
		this.renderMeasurement = measurement;
		const prepareStart = this.performance.now();
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.renderPending = false;
		const range = this.viewport.getVisibleVerticalRange();
		// Prepare a full viewport ahead, retaining two rows above for jumps
		// into unvisited areas. Completed ranges never need scroll-driven work.
		const firstVisible = range.top - 2 * spacing;
		const lastVisible =
			range.bottom + Math.max(2 * spacing, range.bottom - range.top);
		const renderGeneration = ++this.renderGeneration;
		const grid: NavGrid = [];
		const retained = new Map(
			this.grid.flat().map((node) => [node.navId, node]),
		);
		const jobs: (() => void)[] = [];
		let renderedToys = 0;
		let updatedToys = 0;
		this.groups ??= groupToys(this.view.values());
		const groups = this.groups;
		const cellsById = this.cellsById;
		const wanted = new Set<string>();
		this.visibleIds = wanted;
		let y = 0;
		groups.forEach((group, groupIndex) => {
			const top = y;
			jobs.push(() => {
				let header = this.headers.at(groupIndex);
				if (!header) {
					header = new Frame(`toys-header-${groupIndex}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(460, 24, "TOPLEFT", this.content, 0, -top);
				const collected = group.toys.filter((toy) => toy.collected).length;
				header.setLabel(
					"title",
					`${group.label} (${collected} / ${group.toys.length})`,
					"LEFT",
					0,
					0,
					15,
					460,
				);
				header.show();
			});
			const firstRow = grid.length;
			for (let i = 0; i < Math.ceil(group.toys.length / columns); i++)
				grid.push([]);
			group.toys.forEach((toy, index) => {
				const row = Math.floor(index / columns);
				const cellTop = top + 28 + row * spacing;
				const source = this.view.get(String(toy.id));
				const navId =
					group.id === -1 ? `toy-favourite-${toy.id}` : `toy-${toy.id}`;
				const cellKey = navId;
				let cell = cellsById.get(cellKey);
				const previous = retained.get(navId);
				const nearby = cellTop + 42 >= firstVisible && cellTop <= lastVisible;
				if (
					!nearby &&
					(!previous ||
						cell?.top !== cellTop ||
						cell.column !== index % columns ||
						cell.source !== source)
				)
					return;
				wanted.add(navId);
				if (previous)
					grid
						.at(firstRow + Math.floor(index / columns))
						?.push(
							previous.navColumn === index % columns
								? previous
								: { ...previous, navColumn: index % columns },
						);
				// Retain visited navigation so a mouse scroll does not replace focus
				// and reveal the first buffered row. Only nearby tiles receive writes.
				if (!nearby) return;

				if (
					cell?.visible &&
					cell.source === source &&
					previous &&
					cell.top === cellTop &&
					cell.column === index % columns &&
					cell.toy?.id === toy.id &&
					cell.toy?.icon === toy.icon &&
					cell.toy?.name === toy.name &&
					cell.toy?.collected === toy.collected &&
					cell.toy?.favourite === toy.favourite &&
					cell.toy?.expansionId === toy.expansionId
				) {
					renderedToys++;
					return;
				}
				jobs.push(() => {
					if (this.view.get(String(toy.id)) !== source) return;
					if (!cell) {
						const frameIndex = this.cells.length;
						cell = {
							border: new Frame(`toys-border-${frameIndex}`, this.pool),
							favourite: new Frame(`toys-favourite-${frameIndex}`, this.pool),
							icon: new Frame(
								`toys-icon-${frameIndex}`,
								this.pool,
								"SecureButton",
							),
							cooldown: new Frame(
								`toys-cooldown-${frameIndex}`,
								this.pool,
								"Cooldown",
							),
						};
						this.cells.push(cell);
					}
					cell.navId = navId;
					cell.key = cellKey;
					cellsById.set(cellKey, cell);
					cell.toy = toy;
					cell.source = source;
					cell.top = cellTop;
					cell.column = index % columns;
					cell.visible = true;
					cell.border.setParent(this.content);
					cell.border.layout(
						42,
						42,
						"TOPLEFT",
						this.content,
						(index % columns) * spacing,
						-cellTop,
					);
					if (!toy.collected) cell.border.setColor(0.12, 0.12, 0.12);
					else cell.border.setColor(0.3, 0.34, 0.42);
					cell.icon.setParent(cell.border);
					cell.icon.layout(38, 38, "CENTER", cell.border);
					cell.icon.setIcon(toy.icon);
					cell.favourite.setParent(cell.icon);
					cell.favourite.layout(20, 20, "TOPLEFT", cell.icon, -6, 6);
					cell.favourite.setAtlasBackground("collections-icon-favorites");
					if (toy.collected && toy.favourite) cell.favourite.show();
					else cell.favourite.hide();
					cell.icon.setOpacity(toy.collected ? 1 : 0.2);
					cell.icon.setToy(toy.collected ? toy.id : undefined);
					cell.cooldown.fill(cell.icon);
					const cooldown = this.client.getCooldown(toy.id);
					cell.cooldown.setCooldown(cooldown.start, cooldown.duration);
					cell.border.show();
					cell.icon.show();
					cell.cooldown.show();
					const control = cell.icon;

					const current = () =>
						this.mounted &&
						this.visibleIds.has(navId) &&
						cell?.visible &&
						cell.navId === navId &&
						cell.toy === toy &&
						this.view.get(String(toy.id)) === source;
					control.setHoverTooltip(() =>
						current() ? { toy: toy.id } : undefined,
					);
					const node = control.navigationNode(
						navId,
						() => {},
						() =>
							this.viewport.revealVerticalRange(
								cellTop,
								cellTop + 42,
								this.contentHeight,
							),
					);
					const navRow = grid.at(firstRow + row);
					const oldIndex =
						navRow?.findIndex((candidate) => candidate.navId === navId) ?? -1;
					if (oldIndex >= 0) navRow?.splice(oldIndex, 1);
					navRow?.push({
						...node,
						navigationScroll: this.navigationScroll,
						navColumn: index % columns,
						tooltipItem: () => (current() ? { toy: toy.id } : undefined),
						secureActions: () => ({
							alternate:
								current() && toy.collected && this.client.canUse(toy.id)
									? control
									: undefined,
						}),
						onContext: () => {
							if (current()) this.menu.open(toy);
						},
					});
					navRow?.sort((a, b) => (a.navColumn ?? 0) - (b.navColumn ?? 0));
					renderedToys++;
					updatedToys++;
				});
			});
			y += 28 + Math.ceil(group.toys.length / columns) * spacing + 14;
		});
		this.contentHeight = Math.max(1, y);
		this.layoutContent();
		this.content.setLabel(
			"empty",
			groups.length === 0 ? "No toys to display" : "",
			"TOPLEFT",
			0,
			-10,
		);
		for (const cell of this.cells) {
			if (!cell.visible || !cell.navId || wanted.has(cell.navId)) continue;
			jobs.push(() => {
				cell.border.hide();
				cell.icon.hide();
				cell.cooldown.hide();
				cell.favourite.hide();
				cell.visible = false;
			});
		}
		for (let i = groups.length; i < this.headers.length; i++) {
			const header = this.headers.at(i);
			jobs.push(() => header?.hide());
		}
		let cursor = 0;
		measurement.add("prepare", this.performance.now() - prepareStart);
		const step = () => {
			if (
				!this.mounted ||
				generation !== this.generation ||
				renderGeneration !== this.renderGeneration ||
				this.client.isInCombat()
			) {
				measurement.finish("paused combat-or-hidden");
				this.renderMeasurement = undefined;
				return;
			}
			this.cancelRender = undefined;
			const pageStart = this.performance.now();
			const previousCount = renderedToys;
			const end = Math.min(jobs.length, cursor + toysConfig.renderPageSize);
			while (cursor < end) jobs.at(cursor++)?.();
			if (complete)
				this.setLoadingProgress(
					jobs.length === 0 ? 1 : 0.5 + (cursor / jobs.length) * 0.5,
				);
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
			else if (this.snapshotComplete && !this.renderPending) {
				this.viewComplete = true;
				this.dirty = false;
				this.frame.setLabel("loading", "", "BOTTOMRIGHT", -16, 16, 12);
				this.loadingTrack.hide();
			}
			if (renderedToys !== previousCount || cursor === jobs.length) {
				// Retain ready controls while batches add or update their identities.
				this.grid = grid.filter((row) => row.length > 0);
				this.navigationChanged?.();
			}
			measurement.add("frames", this.performance.now() - pageStart);
			measurement.page(pageStart);
			if (cursor === jobs.length) {
				if (!this.renderPending)
					this.rememberPreparedRange(firstVisible, lastVisible);
				measurement.finish(
					`complete updatedTiles=${updatedToys} readyTiles=${renderedToys} merged=${this.renderPending}`,
				);
				this.renderMeasurement = undefined;
				if (!this.renderPending) this.requestViewportRender();
			}
			if (cursor === jobs.length && this.renderPending) {
				this.cancelRender = this.scheduler.nextFrame(() => {
					this.cancelRender = undefined;
					if (
						this.mounted &&
						generation === this.generation &&
						!this.client.isInCombat()
					)
						this.render(generation, this.snapshotComplete);
				});
			}
		};
		step();
	}
	private layoutContent(): void {
		// Re-anchoring a ScrollFrame's child resets its visual position while
		// GetVerticalScroll still reports the previous offset.
		if (this.laidOutHeight === this.contentHeight) return;
		this.content.layout(460, this.contentHeight, "TOPLEFT", this.viewport);
		this.laidOutHeight = this.contentHeight;
		this.viewport.clampScroll();
	}
	refreshCooldowns(): void {
		if (!this.mounted || this.client.isInCombat()) return;
		if (this.cancelCooldown) {
			this.repeatCooldown = true;
			return;
		}
		const range = this.viewport.getVisibleVerticalRange();
		const cells = this.cells.filter(
			(cell) =>
				cell.visible &&
				cell.top !== undefined &&
				cell.top + 42 >= range.top - 2 * spacing &&
				cell.top <= range.bottom + 2 * spacing,
		);
		const generation = this.generation;
		let cursor = 0;
		const step = () => {
			this.cancelCooldown = undefined;
			if (
				!this.mounted ||
				generation !== this.generation ||
				this.client.isInCombat()
			)
				return;
			const end = Math.min(cells.length, cursor + toysConfig.cooldownPageSize);
			while (cursor < end) {
				const index = cursor++;
				const cell = cells.at(index);
				const toy = cell?.toy;
				if (toy && cell?.navId && this.visibleIds.has(cell.navId)) {
					const cooldown = this.client.getCooldown(toy.id);
					cell.cooldown.setCooldown(cooldown.start, cooldown.duration);
				}
			}
			if (cursor < cells.length)
				this.cancelCooldown = this.scheduler.nextFrame(step);
			else if (this.repeatCooldown) {
				this.repeatCooldown = false;
				this.cancelCooldown = this.scheduler.nextFrame(() => {
					this.cancelCooldown = undefined;
					this.refreshCooldowns();
				});
			}
		};
		step();
	}
	resume(): void {
		if (!this.mounted || this.client.isInCombat()) return;
		if (this.mountPending && this.parent) this.onMount(this.parent);
		else if (this.dirty) this.render(this.generation, this.snapshotComplete);
		else this.requestViewportRender();
		this.refreshCooldowns();
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
		this.navigationChanged = callback;
	}
	getNavGrid(): NavGrid {
		return this.mounted && !this.mountPending
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
		this.renderMeasurement?.finish("cancelled close");
		this.renderMeasurement = undefined;
		this.mounted = false;
		this.controls.hide();
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.cancelViewport?.();
		this.cancelViewport = undefined;
		this.viewport.onVerticalScroll();
		this.cancelCooldown?.();
		this.cancelCooldown = undefined;
		this.repeatCooldown = false;
		this.menu.close();
		this.frame.hide();
	}
	destroy(): void {
		this.onUnmount();
		// Collection controls retain their acquired native frames for the session.
	}
}
