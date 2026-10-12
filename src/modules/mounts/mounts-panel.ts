import type { IMountsClient, Mount } from "../../clients/mounts-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Dropdown } from "../../ui/components/dropdown";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import type { IMountActionMenu } from "./mount-action-menu";
import { groupMounts } from "./mount-display";

const columns = 10;
const spacing = 46;
interface MountCell {
	readonly border: Frame;
	readonly favourite: Frame;
	readonly icon: Frame;
}

export class MountsPanel implements IPanel {
	readonly id = "mounts";
	readonly title = "Mounts";
	readonly icon = 132261;
	private readonly frame: Frame;
	private readonly search: Frame;
	private readonly searchNavigation: INavigable;
	private readonly filters: Dropdown;
	private readonly footer: Frame;
	private readonly equipment: Frame;
	private readonly favourite: Frame;
	private readonly flight: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly loadingTrack: Frame;
	private readonly loadingProgress: Frame;
	private readonly cells: MountCell[] = [];
	private readonly headers: Frame[] = [];
	private grid: NavGrid = [];
	private contentHeight = 1;
	private mounted = false;
	private dirty = true;
	private cancelLoad?: () => void;
	private cancelRender?: () => void;
	private loadGeneration = 0;
	private renderGeneration = 0;
	private mounts: readonly Mount[] = [];
	private snapshotComplete = false;
	private queuedRefresh = false;
	private cancelRefresh?: () => void;
	private cancelReconcile?: () => void;
	private readonly favouriteOverrides = new Map<number, boolean>();
	private readonly pendingFavourites = new Map<
		number,
		{ previous: boolean; value: boolean; accepted: boolean }
	>();
	private navigationChanged?: () => void;

	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IMountsClient,
		private readonly close: () => void,
		private readonly scheduler: ITaskScheduler,
		private readonly menu: IMountActionMenu,
	) {
		this.frame = new Frame("mounts-root", pool);
		this.search = new Frame("mounts-search", pool, "EditBox");
		this.searchNavigation = {
			navId: this.search.id,
			onFocus: () => this.search.setFocused(true),
			onBlur: () => {
				this.search.setFocused(false);
				this.search.blurInput();
			},
			onInteract: () => {
				if (this.mounted) this.search.focusInput();
			},
		};
		this.filters = new Dropdown("mounts-filters", pool);
		this.footer = new Frame("mounts-footer", pool);
		this.equipment = new Frame("mounts-equipment", pool, "Button");
		this.favourite = new Frame("mounts-random", pool, "Button");
		this.flight = new Frame("mounts-flight", pool, "SecureButton");
		this.viewport = new Frame("mounts-scroll", pool, "ScrollFrame");
		this.content = new Frame("mounts-content", pool);
		this.loadingTrack = new Frame("mounts-loading-track", pool);
		this.loadingProgress = new Frame("mounts-loading-progress", pool);
	}

	refresh(): void {
		const generation = ++this.loadGeneration;
		this.renderGeneration++;
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.queuedRefresh = false;
		this.snapshotComplete = false;
		this.menu.close();
		this.dirty = true;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.grid = [];
		this.navigationChanged?.();
		if (!this.mounted) return;
		this.frame.setLabel(
			"loading",
			"Loading mounts...",
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
			(mounts, count) => {
				if (!this.mounted || generation !== this.loadGeneration) return;
				this.cancelLoad = undefined;
				this.frame.setLabel(
					"count",
					`${count.collected} / ${count.total}`,
					"TOPLEFT",
					16,
					-44,
					14,
				);
				this.snapshotComplete = true;
				this.acceptSnapshot(mounts, true);
				this.render(this.mounts, generation, true);
			},
			(mounts) => {
				if (this.mounted && generation === this.loadGeneration) {
					this.acceptSnapshot(mounts);
					this.render(this.mounts, generation, false);
				}
			},
			(completed, total) => {
				if (this.mounted && generation === this.loadGeneration)
					this.setLoadingProgress(
						total === 0 ? 0.5 : (completed / total) * 0.5,
					);
			},
		);
		this.filters.setOptions(
			this.client.getFilters().map((filter) => ({
				id: filter.id,
				label: `${filter.checked ? "[x]" : "[ ]"} ${filter.label}`,
				activate: () => {
					this.client.toggleFilter(filter.id);
					this.refresh();
				},
			})),
		);
		this.refreshEquipment();
	}

	refreshEquipment(): void {
		if (!this.mounted) return;
		const equipment = this.client.getEquipment();
		this.equipment.setIcon(equipment.icon);
		this.equipment.setTooltip(equipment.label, equipment.link);
		this.flight.setSpell(this.client.getUtilitySpells().flight);
	}

	/** Event bursts must not repeatedly cancel an unfinished journal scan. */
	invalidate(): void {
		this.dirty = true;
		if (!this.mounted) return;
		if (this.cancelLoad || this.cancelRender) {
			this.queuedRefresh = true;
			return;
		}
		if (this.cancelRefresh) return;
		this.cancelRefresh = this.scheduler.nextFrame(() => {
			this.cancelRefresh = undefined;
			if (this.mounted) this.refresh();
		});
	}

	private acceptSnapshot(mounts: readonly Mount[], complete = false): void {
		this.mounts = mounts.map((mount) => {
			const favourite = this.favouriteOverrides.get(mount.id);
			if (favourite === undefined) return mount;
			if (
				mount.favourite === favourite ||
				(complete && !this.pendingFavourites.has(mount.id))
			)
				this.favouriteOverrides.delete(mount.id);
			return mount.favourite === favourite ? mount : { ...mount, favourite };
		});
	}

	toggleFavourite(id: number): void {
		const mount = this.mounts.find((mount) => mount.id === id);
		if (!this.mounted || !mount?.collected) return;
		const request = {
			previous: mount.favourite,
			value: !mount.favourite,
			accepted: false,
		};
		this.pendingFavourites.set(id, request);
		this.favouriteOverrides.set(id, request.value);
		this.updateFavourite(id, request.value);
		this.client.setFavourite(id, request.value, (accepted) => {
			if (this.pendingFavourites.get(id) !== request) return;
			request.accepted = accepted;
			if (!accepted) {
				this.pendingFavourites.delete(id);
				this.favouriteOverrides.delete(id);
				this.updateFavourite(id, request.previous);
			}
		});
	}

	private updateFavourite(id: number, favourite: boolean): void {
		this.mounts = this.mounts.map((mount) =>
			mount.id === id && mount.favourite !== favourite
				? { ...mount, favourite }
				: mount,
		);
		if (this.mounted)
			this.render(this.mounts, this.loadGeneration, this.snapshotComplete);
		else this.dirty = true;
	}

	onJournalSearchUpdated(): void {
		if (
			this.pendingFavourites.size === 0 &&
			this.favouriteOverrides.size === 0
		) {
			this.invalidate();
			return;
		}
		if (this.cancelReconcile) return;
		this.cancelReconcile = this.scheduler.nextFrame(() => {
			this.cancelReconcile = undefined;
			for (const [id, request] of this.pendingFavourites) {
				if (!request.accepted) continue;
				const actual = this.client.getFavourite(id);
				this.pendingFavourites.delete(id);
				// A scan started before the request can still publish stale data.
				if (this.cancelLoad) this.favouriteOverrides.set(id, actual);
				else this.favouriteOverrides.delete(id);
				if (actual !== request.value) this.updateFavourite(id, actual);
			}
		});
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

	private render(
		mounts: readonly Mount[],
		generation: number,
		complete: boolean,
	): void {
		this.cancelRender?.();
		const renderGeneration = ++this.renderGeneration;
		const grid: NavGrid = [];
		const jobs: (() => void)[] = [];
		const groups = groupMounts(mounts);
		let y = 0;
		let cellIndex = 0;
		let renderedRows = 0;
		groups.forEach((group, groupIndex) => {
			const top = y;
			jobs.push(() => {
				let header = this.headers.at(groupIndex);
				if (!header) {
					header = new Frame(`mounts-header-${groupIndex}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(460, 24, "TOPLEFT", this.content, 0, -top);
				const collected = group.mounts.filter(
					(mount) => mount.collected,
				).length;
				header.setLabel(
					"title",
					`${group.label} (${collected} / ${group.mounts.length})`,
					"LEFT",
					0,
					0,
					15,
					460,
				);
				header.show();
			});
			const firstRow = grid.length;
			for (let i = 0; i < Math.ceil(group.mounts.length / columns); i++)
				grid.push([]);
			group.mounts.forEach((mount, index) => {
				const slot = cellIndex++;
				const row = firstRow + Math.floor(index / columns);
				const cellTop = top + 28 + Math.floor(index / columns) * spacing;
				jobs.push(() => {
					let cell = this.cells.at(slot);
					if (!cell) {
						cell = {
							border: new Frame(`mounts-border-${slot}`, this.pool),
							favourite: new Frame(`mounts-favourite-${slot}`, this.pool),
							icon: new Frame(`mounts-icon-${slot}`, this.pool, "Button"),
						};
						this.cells.push(cell);
					}
					cell.border.setParent(this.content);
					cell.border.layout(
						42,
						42,
						"TOPLEFT",
						this.content,
						(index % columns) * spacing,
						-cellTop,
					);
					if (!mount.collected) cell.border.setColor(0.12, 0.12, 0.12);
					else cell.border.setColor(0.3, 0.34, 0.42);
					cell.icon.setParent(cell.border);
					cell.icon.layout(38, 38, "CENTER", cell.border);
					cell.icon.setIcon(mount.icon);
					cell.favourite.setParent(cell.icon);
					cell.favourite.layout(20, 20, "TOPLEFT", cell.icon, -6, 6);
					cell.favourite.setAtlasBackground("PetJournal-FavoritesIcon");
					if (mount.collected && mount.favourite) cell.favourite.show();
					else cell.favourite.hide();
					cell.icon.setOpacity(mount.collected ? 1 : 0.2);
					cell.icon.setTooltip(
						mount.name,
						!mount.collected
							? "Not collected"
							: !mount.usable
								? "Unavailable here"
								: "Y: Actions",
					);
					const current = () =>
						this.mounted &&
						generation === this.loadGeneration &&
						renderGeneration === this.renderGeneration;
					const summon = () => {
						if (current() && mount.collected && this.client.canUse(mount.id))
							this.client.summon(mount.id);
					};
					cell.icon.onClick((button) => {
						if (button === "LeftButton" || button === "RightButton") summon();
					});
					cell.border.show();
					cell.icon.show();
					const node = cell.icon.navigationNode(
						group.id === -1
							? `mount-favourite-${mount.id}`
							: `mount-${mount.id}`,
						() => {},
						() =>
							this.viewport.revealVerticalRange(
								cellTop,
								cellTop + 42,
								this.contentHeight,
							),
					);
					grid.at(row)?.push({
						...node,
						navColumn: index % columns,
						onAlternate: summon,
						tooltipItem: () =>
							current() ? { mountSpell: mount.spell } : undefined,
						onContext: () => {
							if (current()) this.menu.open(mount);
						},
					});
					renderedRows = row + 1;
				});
			});
			y += 28 + Math.ceil(group.mounts.length / columns) * spacing + 14;
		});
		this.contentHeight = Math.max(1, y);
		this.layoutContent();
		this.content.setLabel(
			"empty",
			mounts.length > 0 ? "" : "No mounts to display",
			"TOPLEFT",
			0,
			-10,
		);
		for (let i = cellIndex; i < this.cells.length; i++) {
			const cell = this.cells.at(i);
			jobs.push(() => {
				cell?.border.hide();
				cell?.icon.hide();
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
				generation !== this.loadGeneration ||
				renderGeneration !== this.renderGeneration
			)
				return;
			this.cancelRender = undefined;
			const end = Math.min(jobs.length, cursor + 10);
			while (cursor < end) jobs.at(cursor++)?.();
			if (complete)
				this.setLoadingProgress(
					jobs.length > 0 ? 0.5 + (cursor / jobs.length) * 0.5 : 1,
				);
			this.grid = grid.slice(0, renderedRows);
			this.navigationChanged?.();
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
			else if (complete) {
				this.dirty = false;
				this.frame.setLabel("loading", "", "BOTTOMRIGHT", -16, 16, 12);
				this.loadingTrack.hide();
				if (this.queuedRefresh) {
					this.queuedRefresh = false;
					this.invalidate();
				}
			}
		};
		this.cancelRender = this.scheduler.nextFrame(step);
	}

	private layoutContent(): void {
		this.content.layout(460, this.contentHeight, "TOPLEFT", this.viewport);
		this.viewport.clampScroll();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Mounts requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		this.frame.setLabel("title", this.title, "TOPLEFT", 16, -12, 20);
		this.frame.setLabel(
			"actions",
			"X: Summon   Y: Actions",
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.viewport.inset(this.frame, 16, 112, 16, 114);
		this.viewport.onSizeChanged(() => {
			if (this.mounted) this.layoutContent();
		});
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.search.setParent(this.frame);
		this.search.layout(320, 32, "TOPLEFT", this.frame, 16, -66);
		this.search.setInsetBackground();
		this.search.configureInput((text) => {
			if (this.mounted) {
				this.client.search(text);
				this.refresh();
			}
		});
		this.search.setTooltip("Search mounts");
		this.search.blurInput();
		this.search.show();
		this.footer.setParent(this.frame);
		this.footer.layout(456, 70, "BOTTOMLEFT", this.frame, 12, 32);
		this.footer.setInsetBackground();
		this.footer.setLabel("equipment", "Equipment", "TOPLEFT", 12, -8, 12);
		this.footer.setLabel("random", "Favourite mount", "TOPLEFT", 100, -8, 12);
		this.footer.setLabel(
			"flight",
			"Switch flight style",
			"TOPLEFT",
			264,
			-8,
			12,
		);
		[this.equipment, this.favourite, this.flight].forEach((button, index) => {
			button.setParent(this.footer);
			button.layout(
				38,
				38,
				"TOPLEFT",
				this.footer,
				[12, 128, 312].at(index),
				-26,
			);
			button.show();
		});
		this.favourite.setIcon(413588);
		this.favourite.setTooltip("Summon a random favourite mount");
		this.favourite.onClick((button) => {
			if (this.mounted && button === "LeftButton") this.client.summon(0);
		});
		this.favourite.onDragStart(() => {
			if (this.mounted) this.client.pickupRandom();
		});
		this.flight.setIcon(4640497);
		this.flight.setTooltip("Switch flight style");
		const applyEquipment = () => {
			if (this.mounted) {
				this.client.applyEquipment();
				this.refreshEquipment();
			}
		};
		this.equipment.onClick(applyEquipment);
		this.equipment.onReceiveDrag(applyEquipment);
		this.footer.show();
		this.filters.mount(this.frame);
		this.frame.show();
		this.mounted = true;
		if (this.dirty) this.refresh();
		else this.layoutContent();
	}
	onContainerClosed(): void {
		this.close();
	}
	onUnmount(): void {
		this.mounted = false;
		this.search.blurInput();
		this.menu.close();
		this.cancelRefresh?.();
		this.cancelRefresh = undefined;
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.filters.hide();
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.frame.hide();
	}
	private nav(button: Frame, alternate = false): INavigable {
		return {
			navId: button.id,
			secureActions:
				button === this.flight
					? () => ({ interact: this.mounted ? button : undefined })
					: undefined,
			onFocus: () => button.setLabel("focus", ">", "BOTTOM", 0, 0),
			onBlur: () => button.setLabel("focus", ""),
			onInteract: () => {
				if (this.mounted && !alternate && button !== this.flight)
					button.click();
			},
			onAlternate: alternate
				? () => {
						if (this.mounted) button.click();
					}
				: undefined,
		};
	}
	getNavGrid(): INavigable[][] {
		if (!this.mounted) return [];
		return [
			[this.searchNavigation],
			...this.filters.getNavGrid(),
			...(this.filters.isOpen() ? [] : this.grid),
			[
				this.nav(this.equipment),
				this.nav(this.favourite, true),
				this.nav(this.flight),
			],
		];
	}
	destroy(): void {
		this.onUnmount();
		this.cancelReconcile?.();
		this.cancelReconcile = undefined;
		this.pendingFavourites.clear();
		this.favouriteOverrides.clear();
		for (const cell of this.cells) {
			cell.icon.destroy();
			cell.favourite.destroy();
			cell.border.destroy();
		}
		for (const header of this.headers) header.destroy();
		this.filters.destroy();
		for (const frame of [
			this.viewport,
			this.content,
			this.loadingProgress,
			this.loadingTrack,
			this.search,
			this.equipment,
			this.favourite,
			this.flight,
			this.footer,
			this.frame,
		])
			frame.destroy();
	}
}
