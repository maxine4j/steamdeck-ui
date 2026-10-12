import type { IMountsClient, Mount } from "../../clients/mounts-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Dropdown } from "../../ui/components/dropdown";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

const columns = 10;
const spacing = 46;
interface MountCell {
	readonly border: Frame;
	readonly icon: Frame;
}

export class MountsPanel implements IPanel {
	readonly id = "mounts";
	readonly title = "Mounts";
	readonly icon = 132261;
	private readonly frame: Frame;
	private readonly search: Frame;
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
	private navigationChanged?: () => void;

	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IMountsClient,
		private readonly close: () => void,
		private readonly scheduler: ITaskScheduler,
	) {
		this.frame = new Frame("mounts-root", pool);
		this.search = new Frame("mounts-search", pool, "EditBox");
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
				this.render(mounts, generation, true);
			},
			(mounts) => {
				if (this.mounted && generation === this.loadGeneration)
					this.render(mounts, generation, false);
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
		const equipment = this.client.getEquipment();
		this.equipment.setIcon(equipment.icon);
		this.equipment.setTooltip(equipment.label, equipment.link);
		this.flight.setSpell(this.client.getUtilitySpells().flight);
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
		const grid: NavGrid = [];
		const jobs: (() => void)[] = [];
		const favourites = mounts.filter((mount) => mount.favourite);
		// Favourites are repeated here and in the full collection.
		const groups = [
			...(favourites.length > 0
				? [{ label: "Favourites", mounts: favourites, favourite: true }]
				: []),
			...(mounts.length > 0
				? [{ label: "Mounts", mounts, favourite: false }]
				: []),
		];
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
					else if (mount.favourite) cell.border.setColor(1, 0.82, 0);
					else cell.border.setColor(0.3, 0.34, 0.42);
					cell.icon.setParent(cell.border);
					cell.icon.layout(38, 38, "CENTER", cell.border);
					cell.icon.setIcon(mount.icon);
					cell.icon.setOpacity(mount.collected ? 1 : 0.2);
					cell.icon.setTooltip(
						mount.name,
						!mount.collected
							? "Not collected"
							: !mount.usable
								? "Unavailable here"
								: "Y: Toggle favourite",
					);
					const current = () =>
						this.mounted && generation === this.loadGeneration;
					const summon = () => {
						if (current() && mount.collected && mount.usable)
							this.client.summon(mount.id);
					};
					const favourite = () => {
						if (current() && mount.collected) {
							this.client.toggleFavourite(mount.id);
							this.refresh();
						}
					};
					cell.icon.onClick((button) => {
						if (button === "LeftButton") summon();
						else if (button === "RightButton") favourite();
					});
					cell.border.show();
					cell.icon.show();
					const node = cell.icon.navigationNode(
						group.favourite
							? `mount-favourite-${mount.id}`
							: `mount-${mount.id}`,
						summon,
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
						tooltipItem: () => (current() ? `spell:${mount.spell}` : undefined),
						onContext: favourite,
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
			if (!this.mounted || generation !== this.loadGeneration) return;
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
		this.frame.setBlackBackground();
		this.frame.setLabel("title", this.title, "TOPLEFT", 16, -12, 20);
		this.frame.setLabel(
			"actions",
			"A: Summon   Y: Favourite",
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
		this.search.setColor(0.12, 0.12, 0.12);
		this.search.configureInput((text) => {
			if (this.mounted) {
				this.client.search(text);
				this.refresh();
			}
		});
		this.search.setTooltip("Search mounts");
		this.search.show();
		this.footer.setParent(this.frame);
		this.footer.layout(456, 70, "BOTTOMLEFT", this.frame, 12, 32);
		this.footer.setColor(0.12, 0.12, 0.12);
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
				this.refresh();
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
		this.cancelLoad?.();
		this.cancelLoad = undefined;
		this.filters.hide();
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.frame.hide();
	}
	private nav(button: Frame): INavigable {
		return {
			navId: button.id,
			onFocus: () => button.setLabel("focus", ">", "BOTTOM", 0, 0),
			onBlur: () => button.setLabel("focus", ""),
			onInteract: () => {
				if (this.mounted) button.click();
			},
		};
	}
	getNavGrid(): INavigable[][] {
		if (!this.mounted) return [];
		return [
			[
				{
					navId: this.search.id,
					onFocus: () => this.search.setColor(0.3, 0.25, 0),
					onBlur: () => this.search.setColor(0.12, 0.12, 0.12),
					onInteract: () => this.search.focusInput(),
				},
			],
			...this.filters.getNavGrid(),
			...(this.filters.isOpen() ? [] : this.grid),
			[
				this.nav(this.equipment),
				this.nav(this.favourite),
				this.nav(this.flight),
			],
		];
	}
	destroy(): void {
		this.onUnmount();
		for (const cell of this.cells) {
			cell.icon.destroy();
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
