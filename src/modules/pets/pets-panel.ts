import {
	type IPerformanceClient,
	quietPerformance,
	WorkMeasurement,
} from "../../clients/performance-client";
import type { IPetsClient, Pet } from "../../clients/pets-client";
import { petsConfig } from "../../clients/pets-config";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { CollectionView } from "../../ui/collection-view";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import { SearchFilters } from "../../ui/components/search-filters";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type {
	INavigable,
	NavGrid,
	NavigationScroll,
} from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import type { IPetActionMenu } from "./pet-action-menu";
import { groupPets } from "./pet-display";

const columns = 10;
const spacing = 46;
interface PetCell {
	navId?: string;
	key?: string;
	pet?: Pet;
	source?: Pet;
	top?: number;
	column?: number;
	visible?: boolean;
	readonly border: Frame;
	readonly favourite: Frame;
	readonly icon: Frame;
}

export class PetsPanel implements IPanel {
	readonly id = "pets";
	readonly title = "Pets";
	readonly icon = 132599;
	private readonly summonButton: Frame;
	private readonly summonNode: INavigable;
	private readonly frame: Frame;
	private readonly footer: Frame;
	private readonly controls: SearchFilters;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly loadingTrack: Frame;
	private readonly loadingProgress: Frame;
	private readonly cells: PetCell[] = [];
	private readonly headers: Frame[] = [];
	private readonly view = new CollectionView<Pet>(
		(row) => row.id,
		(row) => row.present !== false && row.displayed !== false,
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
	private grid: NavGrid = [];
	private visibleIds = new Set<string>();
	private contentHeight = 1;
	private navigationChanged?: (focusId?: string) => void;
	private readonly navigationScroll: NavigationScroll = {
		scrollToEdge: (direction: "up" | "down") => {
			if (this.viewComplete && !this.cancelRender)
				this.viewport.scrollToEdge(direction);
		},
	};
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IPetsClient,
		private readonly menu: IPetActionMenu,
		private readonly scheduler: ITaskScheduler,
		private readonly close: () => void,
		private readonly performance: IPerformanceClient = quietPerformance,
	) {
		this.summonButton = new Frame("pets-summon-favourite", pool, "Button");
		this.summonNode = this.summonButton.navigationNode(
			"pets-summon-favourite",
			() => {
				if (this.mounted) this.client.summonFavourite();
			},
		);
		this.frame = new Frame("pets-root", pool);
		this.footer = new Frame("pets-footer", pool);
		this.controls = new SearchFilters(
			"pets",
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
		this.viewport = new Frame("pets-scroll", pool, "ScrollFrame");
		this.content = new Frame("pets-content", pool);
		this.loadingTrack = new Frame("pets-loading-track", pool);
		this.loadingProgress = new Frame("pets-loading-progress", pool);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Pets requires a frame parent");
		this.parent = parent;
		this.mounted = true;
		this.mountPending = this.client.isInCombat();
		if (this.mountPending) return;
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.frame.setLabel(
			"actions",
			`${controllerIcon("X")} Summon   ${controllerIcon("Y")} Actions`,
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.frame.show();
		this.controls.mount(this.frame);
		this.footer.setParent(this.frame);
		this.footer.layout(456, 70, "BOTTOMLEFT", this.frame, 12, 32);
		this.footer.setInsetBackground();
		this.footer.setLabel("random", "Favourite pet", "TOPLEFT", 12, -8, 12);
		this.summonButton.setParent(this.footer);
		this.summonButton.layout(38, 38, "TOPLEFT", this.footer, 12, -26);
		this.summonButton.setIcon(this.icon);
		this.summonButton.setTooltip("Summon a random favourite pet");
		this.summonButton.onClick((button) => {
			if (this.mounted && button === "LeftButton")
				this.client.summonFavourite();
		});
		this.summonButton.show();
		this.footer.show();
		this.viewport.inset(this.frame, 16, 112, 16, 114);
		this.viewport.onSizeChanged(() => {
			if (this.mounted) this.layoutContent();
		});
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.mounted = true;
		this.refresh();
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
			"Loading pets...",
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
			(pets, complete = true) => {
				if (!this.mounted || generation !== this.generation) return;
				this.snapshotComplete = complete;
				this.dirty = true;
				this.viewComplete = false;
				this.view.replace(pets);
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
	private render(generation: number, complete = true): void {
		const measurement = new WorkMeasurement(
			this.performance,
			"pets render",
			"cache-update",
		);
		this.renderMeasurement = measurement;
		const prepareStart = this.performance.now();
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.renderPending = false;
		const renderGeneration = ++this.renderGeneration;
		const grid: NavGrid = [];
		const retained = new Map(
			this.grid.flat().map((node) => [node.navId, node]),
		);
		const jobs: (() => void)[] = [];
		let renderedPets = 0;
		const groups = groupPets(this.view.values());
		const cellsById = new Map<string, PetCell>();
		for (const cell of this.cells) if (cell.key) cellsById.set(cell.key, cell);
		const wanted = new Set(
			groups.flatMap((group) =>
				group.pets.map((pet) =>
					group.id === -1 ? `pet-favourite-${pet.id}` : `pet-${pet.id}`,
				),
			),
		);
		this.visibleIds = wanted;
		const available = this.cells.filter(
			(cell) => cell.visible && cell.navId && !wanted.has(cell.navId),
		);
		let y = 0;
		groups.forEach((group, groupIndex) => {
			const top = y;
			jobs.push(() => {
				let header = this.headers.at(groupIndex);
				if (!header) {
					header = new Frame(`pets-header-${groupIndex}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(460, 24, "TOPLEFT", this.content, 0, -top);
				const collected = group.pets.filter((pet) => pet.collected).length;
				header.setLabel(
					"title",
					`${group.label} (${collected} / ${group.pets.length})`,
					"LEFT",
					0,
					0,
					15,
					460,
				);
				header.show();
			});
			const firstRow = grid.length;
			for (let i = 0; i < Math.ceil(group.pets.length / columns); i++)
				grid.push([]);
			group.pets.forEach((pet, index) => {
				const source = this.view.get(pet.id);
				const navId =
					group.id === -1 ? `pet-favourite-${pet.id}` : `pet-${pet.id}`;
				const cellKey = `${group.id === -1 ? "favourite" : "species"}-${pet.speciesId}`;
				let cell = cellsById.get(cellKey);
				const previous = retained.get(navId);
				if (previous)
					grid
						.at(firstRow + Math.floor(index / columns))
						?.push(
							previous.navColumn === index % columns
								? previous
								: { ...previous, navColumn: index % columns },
						);
				const row = Math.floor(index / columns);
				const cellTop = top + 28 + row * spacing;

				if (
					cell?.visible &&
					cell.source === source &&
					previous &&
					cell.top === cellTop &&
					cell.column === index % columns &&
					cell.pet?.id === pet.id &&
					cell.pet?.icon === pet.icon &&
					cell.pet?.name === pet.name &&
					cell.pet?.collected === pet.collected &&
					cell.pet?.favourite === pet.favourite &&
					cell.pet?.ownedCount === pet.ownedCount &&
					cell.pet?.collectionLimit === pet.collectionLimit &&
					cell.pet?.source === pet.source &&
					cell.pet?.description === pet.description &&
					cell.pet?.expansionId === pet.expansionId
				) {
					renderedPets++;
					return;
				}
				jobs.push(() => {
					if (this.view.get(pet.id) !== source) return;
					if (!cell) {
						const frameIndex = this.cells.length;
						cell = {
							border: new Frame(`pets-border-${frameIndex}`, this.pool),
							favourite: new Frame(`pets-favourite-${frameIndex}`, this.pool),
							icon: new Frame(`pets-icon-${frameIndex}`, this.pool, "Button"),
						};
						this.cells.push(cell);
					}
					cell.navId = navId;
					cell.key = cellKey;
					cell.pet = pet;
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
					if (!pet.collected) cell.border.setColor(0.12, 0.12, 0.12);
					else cell.border.setColor(0.3, 0.34, 0.42);
					cell.icon.setParent(cell.border);
					cell.icon.layout(38, 38, "CENTER", cell.border);
					cell.icon.setIcon(pet.icon);
					cell.icon.setLabel(
						"copies",
						pet.ownedCount > 1
							? `${pet.ownedCount}/${pet.collectionLimit ?? 3}`
							: "",
						"BOTTOMRIGHT",
						-1,
						1,
						10,
					);
					cell.favourite.setParent(cell.icon);
					cell.favourite.layout(20, 20, "TOPLEFT", cell.icon, -6, 6);
					cell.favourite.setAtlasBackground("collections-icon-favorites");
					if (pet.collected && pet.favourite) cell.favourite.show();
					else cell.favourite.hide();
					cell.icon.setOpacity(pet.collected ? 1 : 0.2);
					cell.border.show();
					cell.icon.show();
					const control = cell.icon;

					const current = () =>
						this.mounted &&
						this.visibleIds.has(navId) &&
						cell?.visible &&
						cell.navId === navId &&
						cell.pet === pet &&
						this.view.get(pet.id) === source;
					control.onClick(() => {
						if (current() && pet.collected) this.client.summon(pet.id);
					});
					control.setHoverTooltip(() => (current() ? { pet } : undefined));
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
						tooltipItem: () => (current() ? { pet } : undefined),
						onAlternate: () => {
							if (current() && pet.collected) this.client.summon(pet.id);
						},
						onContext: () => {
							if (current()) this.menu.open(pet);
						},
					});
					navRow?.sort((a, b) => (a.navColumn ?? 0) - (b.navColumn ?? 0));
					renderedPets++;
				});
			});
			y += 28 + Math.ceil(group.pets.length / columns) * spacing + 14;
		});
		this.contentHeight = Math.max(1, y);
		this.layoutContent();
		this.content.setLabel(
			"empty",
			groups.length === 0 ? "No pets to display" : "",
			"TOPLEFT",
			0,
			-10,
		);
		for (const cell of available) {
			jobs.push(() => {
				cell.border.hide();
				cell.icon.hide();
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
			const previousCount = renderedPets;
			const end = Math.min(jobs.length, cursor + petsConfig.renderPageSize);
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
			if (renderedPets !== previousCount || cursor === jobs.length) {
				// Retain ready controls while batches add or update their identities.
				this.grid = grid.filter((row) => row.length > 0);
				this.navigationChanged?.();
			}
			measurement.add("frames", this.performance.now() - pageStart);
			measurement.page(pageStart);
			if (cursor === jobs.length) {
				measurement.finish(
					`complete tiles=${renderedPets} merged=${this.renderPending}`,
				);
				this.renderMeasurement = undefined;
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
		this.content.layout(460, this.contentHeight, "TOPLEFT", this.viewport);
		this.viewport.clampScroll();
	}
	resume(): void {
		if (!this.mounted || this.client.isInCombat()) return;
		if (this.mountPending && this.parent) this.onMount(this.parent);
		else if (this.dirty) this.render(this.generation, this.snapshotComplete);
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
		this.navigationChanged = callback;
	}
	getNavGrid(): NavGrid {
		return this.mounted && !this.mountPending
			? [
					...this.controls.getNavGrid(),
					...(this.controls.isOpen() ? [] : [...this.grid, [this.summonNode]]),
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
		this.menu.close();
		this.frame.hide();
	}
	destroy(): void {
		this.onUnmount();
		// Collection controls retain their acquired native frames for the session.
	}
}
