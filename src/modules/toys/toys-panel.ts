import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IToysClient, Toy } from "../../clients/toys-client";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import type { IToyActionMenu } from "./toy-action-menu";
import { groupToys } from "./toy-display";

const columns = 10;
const spacing = 46;
interface ToyCell {
	navId?: string;
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
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly loadingTrack: Frame;
	private readonly loadingProgress: Frame;
	private readonly cells: ToyCell[] = [];
	private readonly headers: Frame[] = [];
	private toys: readonly Toy[] = [];
	private displayed: readonly Toy[] = [];
	private displayedCells: readonly ToyCell[] = [];
	private mounted = false;
	private parent?: Frame;
	private mountPending = false;
	private dirty = true;
	private loading = false;
	private snapshotComplete = false;
	private viewComplete = false;
	private queuedRefresh = false;
	private generation = 0;
	private renderGeneration = 0;
	private renderLoadGeneration = 0;
	private cancelLoad?: () => void;
	private cancelRender?: () => void;
	private grid: NavGrid = [];
	private contentHeight = 1;
	private navigationChanged?: () => void;
	private readonly navigationScroll = {
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
	) {
		this.frame = new Frame("toys-root", pool);
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
		this.viewport.inset(this.frame, 16, 20, 16, 48);
		this.viewport.onSizeChanged(() => {
			if (this.mounted) this.layoutContent();
		});
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.mounted = true;
		if (this.dirty) this.refresh(true);
		else {
			this.layoutContent();
			this.refreshCooldowns();
		}
	}
	invalidate(): void {
		if (this.mounted && this.snapshotComplete) {
			this.queuedRefresh = true;
			this.dirty = true;
			return;
		}
		if (this.mounted && (this.loading || this.cancelRender)) {
			this.queuedRefresh = true;
			return;
		}
		this.refresh();
	}
	refresh(retainCachedView = false): void {
		this.snapshotComplete = false;
		this.viewComplete = false;
		this.loading = false;
		this.queuedRefresh = false;
		this.dirty = true;
		const generation = ++this.generation;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.menu.close();
		// Retain logical navigation while waiting for a replacement snapshot.
		// Existing action callbacks are invalidated by the load generation.
		this.navigationChanged?.();
		if (!this.mounted || this.client.isInCombat()) return;
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
		this.loading = true;
		this.cancelLoad = this.client.load(
			(toys) => {
				if (!this.mounted || generation !== this.generation) return;
				this.cancelLoad = undefined;
				this.loading = false;
				this.snapshotComplete = true;
				this.toys = toys;
				if (!this.client.isInCombat()) this.render(generation);
			},
			(completed, total) => {
				if (!this.mounted || generation !== this.generation) return;
				// Scanning and rendering each occupy half the bar. These are work
				// fractions, not an estimate of elapsed time.
				this.setLoadingProgress(total === 0 ? 0.5 : (completed / total) * 0.5);
			},
			(toys) => {
				if (!this.mounted || generation !== this.generation) return;
				this.toys = toys;
				if (!this.client.isInCombat()) this.render(generation, false);
			},
			retainCachedView,
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
	private render(generation: number, complete = true): void {
		this.cancelRender?.();
		this.cancelRender = undefined;
		const renderGeneration = ++this.renderGeneration;
		// Keep targets for retained toys; clear removed identities before reuse.
		const replacing =
			this.grid.length > 0 && this.renderLoadGeneration === generation;
		this.renderLoadGeneration = generation;
		const grid: NavGrid = [];
		const retained = new Map(
			this.grid.flat().map((node) => [node.navId, node]),
		);
		const displayed: Toy[] = [];
		const displayedCells: ToyCell[] = [];
		const jobs: (() => void)[] = [];
		let renderedToys = 0;
		const groups = groupToys(this.toys);
		const cellsById = new Map<string, ToyCell>();
		for (const cell of this.cells)
			if (cell.navId) cellsById.set(cell.navId, cell);
		const wanted = new Set(
			groups.flatMap((group) =>
				group.toys.map((toy) =>
					group.id === -1 ? `toy-favourite-${toy.id}` : `toy-${toy.id}`,
				),
			),
		);
		const available = this.cells.filter(
			(cell) => !cell.navId || !wanted.has(cell.navId),
		);
		for (const cell of available) cell.navId = undefined;
		if (replacing) this.navigationChanged?.();
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
				const cellIndex = displayed.length;
				const navId =
					group.id === -1 ? `toy-favourite-${toy.id}` : `toy-${toy.id}`;
				let cell = cellsById.get(navId) ?? available.pop();
				const previous = retained.get(navId);
				if (previous)
					grid.at(firstRow + Math.floor(index / columns))?.push({
						...previous,
						navColumn: index % columns,
					});
				displayed.push(toy);
				const row = Math.floor(index / columns);
				const cellTop = top + 28 + row * spacing;
				jobs.push(() => {
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
					displayedCells[cellIndex] = cell;
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
					// This control is ready once its render job finishes. Dirty tracks
					// unfinished work for reopening, not readiness of rendered controls.
					const current = () =>
						this.mounted &&
						generation === this.generation &&
						cell?.navId === navId;
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
		for (const cell of available) {
			jobs.push(() => {
				cell.border.hide();
				cell.icon.hide();
				cell.cooldown.hide();
				cell.favourite.hide();
				cell.navId = undefined;
			});
		}
		for (let i = groups.length; i < this.headers.length; i++) {
			const header = this.headers.at(i);
			jobs.push(() => header?.hide());
		}
		let cursor = 0;
		const step = () => {
			if (
				!this.mounted ||
				generation !== this.generation ||
				renderGeneration !== this.renderGeneration ||
				this.client.isInCombat()
			)
				return;
			this.cancelRender = undefined;
			const previousCount = renderedToys;
			const end = Math.min(jobs.length, cursor + 10);
			while (cursor < end) jobs.at(cursor++)?.();
			if (complete)
				this.setLoadingProgress(
					jobs.length === 0 ? 1 : 0.5 + (cursor / jobs.length) * 0.5,
				);
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
			else if (complete) {
				this.viewComplete = true;
				this.dirty = false;
				this.frame.setLabel("loading", "", "BOTTOMRIGHT", -16, 16, 12);
				this.loadingTrack.hide();
			}
			if (renderedToys !== previousCount || cursor === jobs.length) {
				// Retain ready controls while batches add or update their identities.
				this.grid = grid.filter((row) => row.length > 0);
				this.displayed = displayed.slice(0, renderedToys);
				this.displayedCells = displayedCells.slice(0, renderedToys);
				this.navigationChanged?.();
			}
			if (complete && cursor === jobs.length && this.queuedRefresh)
				this.invalidate();
		};
		this.cancelRender = this.scheduler.nextFrame(step);
	}
	private layoutContent(): void {
		this.content.layout(460, this.contentHeight, "TOPLEFT", this.viewport);
		this.viewport.clampScroll();
	}
	refreshCooldowns(): void {
		if (!this.mounted) return;
		this.displayed.forEach((toy, index) => {
			const cooldown = this.client.getCooldown(toy.id);
			this.displayedCells
				.at(index)
				?.cooldown.setCooldown(cooldown.start, cooldown.duration);
		});
	}
	resume(): void {
		if (!this.mounted || this.client.isInCombat()) return;
		if (this.mountPending && this.parent) this.onMount(this.parent);
		else if (this.dirty && !this.viewComplete) this.refresh(true);
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	getNavGrid(): NavGrid {
		return this.mounted ? this.grid : [];
	}
	onContainerClosed(): void {
		this.close();
	}
	onUnmount(): void {
		this.mounted = false;
		this.loading = false;
		if (this.queuedRefresh) this.dirty = true;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.menu.close();
		this.frame.hide();
	}
	destroy(): void {
		this.onUnmount();
		for (const cell of this.cells) {
			cell.cooldown.destroy();
			cell.icon.destroy();
			cell.favourite.destroy();
			cell.border.destroy();
		}
		for (const header of this.headers) header.destroy();
		this.cells.length = 0;
		this.headers.length = 0;
		this.content.destroy();
		this.viewport.destroy();
		this.loadingProgress.destroy();
		this.loadingTrack.destroy();
		this.frame.destroy();
	}
}
