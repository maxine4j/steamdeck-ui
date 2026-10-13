import type {
	IInventoryActions,
	InventoryItem,
} from "../../clients/inventory-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import {
	commaNumber,
	formatMoney,
	type GroupMode,
	groupItems,
} from "./bag-display";
import type { IItemActionMenu } from "./item-action-menu";

const qualityColors: readonly (readonly [number, number, number])[] = [
	[0.62, 0.62, 0.62],
	[1, 1, 1],
	[0.12, 1, 0],
	[0, 0.44, 0.87],
	[0.64, 0.21, 0.93],
	[1, 0.5, 0],
	[0.9, 0.8, 0.5],
	[0, 0.8, 1],
	[0, 0.8, 1],
];
const itemsPerRow = 5;
const itemSpacing = 46;
const categoryWidth = 226;
const categorySpacing = 234;
export class BagsPanel implements IPanel {
	readonly icon = 133633;
	private readonly icons: { border: Frame; icon: Frame }[] = [];
	private readonly headers: Frame[] = [];
	private readonly toggle: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private items: readonly InventoryItem[] = [];
	private mode: GroupMode = "category";
	private money = 0;
	private mounted = false;
	private dirty = true;
	private contentHeight = 1;
	private rendering = false;
	private cancelRender?: () => void;
	private navGrid: NavGrid = [];
	private navigationChanged?: () => void;
	private visibilityChanged?: (visible: boolean) => void;
	constructor(
		public readonly id: string,
		public readonly title: string,
		private readonly frame: Frame,
		private readonly pool: IFramePoolManager,
		private readonly actions: IInventoryActions,
		private readonly menu: IItemActionMenu,
		private readonly scheduler: ITaskScheduler,
	) {
		this.toggle = new Frame(`${id}-group-toggle`, pool, "Button");
		this.viewport = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
	}
	setItems(items: readonly InventoryItem[]): void {
		this.menu.close();
		this.items = items;
		this.dirty = true;
		if (this.mounted) this.render();
	}
	setMoney(copper: number): void {
		this.money = copper;
		if (this.mounted) this.renderMoney();
	}
	setVisibilityChanged(callback?: (visible: boolean) => void): void {
		this.visibilityChanged = callback;
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Bags requires a frame parent");
		this.visibilityChanged?.(true);
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		this.frame.setLabel(
			"actions",
			"X: Use / Equip   Y: Actions",
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.frame.show();
		this.toggle.setParent(this.frame);
		this.toggle.layout(180, 30, "TOPLEFT", this.frame, 16, -16);
		this.toggle.setButtonBackground();
		this.toggle.onClick((button) => {
			if (button !== "LeftButton") return;
			this.toggleGrouping();
		});
		this.toggle.show();
		this.viewport.inset(this.frame, 16, 58, 16, 48);
		this.viewport.onSizeChanged(() => {
			if (this.mounted) this.layoutContent();
		});
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.mounted = true;
		if (this.dirty) this.render();
		else this.layoutContent();
		this.renderMoney();
	}
	private renderMoney(): void {
		this.frame.setLabel(
			"money",
			formatMoney(this.money),
			"BOTTOMRIGHT",
			-16,
			16,
			16,
		);
	}
	private render(): void {
		this.cancelRender?.();
		this.dirty = true;
		this.rendering = true;
		const jobs: (() => void)[] = [];
		const grid: NavGrid = [
			[
				this.toggle.navigationNode(`${this.id}-group-toggle`, () =>
					this.toggleGrouping(),
				),
			],
		];
		let navRow = 1;
		let navRowHeight = 0;
		this.toggle.setLabel(
			"mode",
			this.mode === "category" ? "Group: Category" : "Group: Expansion",
		);
		const groups = groupItems(this.items, this.mode);
		let y = 0;
		let rowHeight = 0;
		let index = 0;
		groups.forEach((group, groupIndex) => {
			const x = (groupIndex % 2) * categorySpacing;
			const groupTop = y;
			const firstNavRow = navRow;
			jobs.push(() => {
				let header = this.headers.at(groupIndex);
				if (!header) {
					header = new Frame(`${this.id}-header-${groupIndex}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(categoryWidth, 24, "TOPLEFT", this.content, x, -groupTop);
				header.setLabel("title", group.label, "LEFT", 0, 0, 15, categoryWidth);
				header.show();
			});
			group.items.forEach((item, itemIndex) => {
				const cellIndex = index++;
				jobs.push(() => {
					let cell = this.icons.at(cellIndex);
					if (!cell) {
						cell = {
							border: new Frame(`${this.id}-border-${cellIndex}`, this.pool),
							icon: new Frame(
								`${this.id}-icon-${cellIndex}`,
								this.pool,
								"Button",
							),
						};
						this.icons.push(cell);
					}
					cell.border.setParent(this.content);
					cell.border.layout(
						42,
						42,
						"TOPLEFT",
						this.content,
						x + (itemIndex % itemsPerRow) * itemSpacing,
						-groupTop - 28 - Math.floor(itemIndex / itemsPerRow) * itemSpacing,
					);
					const color = qualityColors.at(item.quality) ?? ([1, 1, 1] as const);
					cell.border.setColor(...color);
					cell.icon.setParent(cell.border);
					cell.icon.layout(38, 38, "CENTER", cell.border);
					cell.icon.setIcon(item.iconFileId);
					const source = item.sources.at(0);
					const top =
						groupTop + 28 + Math.floor(itemIndex / itemsPerRow) * itemSpacing;
					const row = firstNavRow + Math.floor(itemIndex / itemsPerRow);
					const cells = grid.at(row) ?? [];
					grid[row] = cells;
					const node = cell.icon.navigationNode(
						`${this.id}-item-${item.itemId}-${source?.bagId}-${source?.slotId}`,
						() => {},
						() =>
							this.viewport.revealVerticalRange(
								top,
								top + 42,
								this.contentHeight,
							),
					);
					cells.push({
						...node,
						navigationScroll: this.viewport,
						tooltipItem: () =>
							this.mounted && !this.rendering
								? (source?.hyperlink ?? item.itemId)
								: undefined,
						onAlternate: () => {
							if (this.mounted && !this.rendering && source)
								this.actions.useItem(source);
						},
						onContext: () => {
							if (this.mounted && !this.rendering && source)
								this.menu.open(source);
						},
						navColumn:
							(groupIndex % 2) * itemsPerRow + (itemIndex % itemsPerRow),
					});
					cell.icon.onClick((button) => {
						if (
							this.mounted &&
							!this.rendering &&
							source &&
							button === "RightButton"
						)
							this.actions.useItem(source);
					});
					cell.icon.onDragStart(() => {
						if (this.mounted && !this.rendering && source)
							this.actions.pickupItem(source);
					});
					cell.icon.setLabel(
						"count",
						item.count > 1 ? commaNumber(item.count) : "",
						"BOTTOMRIGHT",
						-1,
						1,
						12,
					);
					cell.icon.setLabel(
						"level",
						item.itemLevel === undefined ? "" : `${item.itemLevel}`,
						"TOPLEFT",
						1,
						-1,
						12,
					);
					cell.border.show();
					cell.icon.show();
				});
			});
			rowHeight = Math.max(
				rowHeight,
				28 + Math.ceil(group.items.length / itemsPerRow) * itemSpacing + 14,
			);
			navRowHeight = Math.max(
				navRowHeight,
				Math.ceil(group.items.length / itemsPerRow),
			);
			if (groupIndex % 2 === 1 || groupIndex === groups.length - 1) {
				y += rowHeight;
				rowHeight = 0;
				navRow += navRowHeight;
				navRowHeight = 0;
			}
		});
		this.contentHeight = Math.max(1, y);
		this.layoutContent();
		this.content.setLabel(
			"empty",
			groups.length === 0 ? "Your bags are empty" : "",
			"TOPLEFT",
			0,
			-10,
		);
		for (let i = index; i < this.icons.length; i++) {
			const cell = this.icons.at(i);
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
			this.cancelRender = undefined;
			const end = Math.min(jobs.length, cursor + 10);
			while (cursor < end) jobs.at(cursor++)?.();
			if (cursor < jobs.length) {
				this.cancelRender = this.scheduler.nextFrame(step);
				return;
			}
			this.navGrid = grid;
			this.dirty = false;
			this.rendering = false;
			this.navigationChanged?.();
		};
		this.cancelRender = this.scheduler.nextFrame(step);
	}
	private layoutContent(): void {
		this.content.layoutVerticallyCentered(
			460,
			this.contentHeight,
			this.viewport,
		);
		this.viewport.clampScroll();
	}
	private toggleGrouping(): void {
		if (!this.mounted) return;
		this.mode = this.mode === "category" ? "expansion" : "category";
		this.viewport.resetScroll();
		this.render();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	onUnmount(): void {
		this.visibilityChanged?.(false);
		this.menu.close();
		this.mounted = false;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.frame.hide();
	}
	getNavGrid(): NavGrid {
		return this.mounted ? this.navGrid : [];
	}
	destroy(): void {
		this.onUnmount();
		for (const cell of this.icons) {
			cell.icon.destroy();
			cell.border.destroy();
		}
		for (const header of this.headers) header.destroy();
		this.icons.length = 0;
		this.headers.length = 0;
		this.toggle.destroy();
		this.content.destroy();
		this.viewport.destroy();
		this.frame.destroy();
	}
}
