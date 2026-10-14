import type {
	IInventoryClient,
	InventoryItem,
	InventorySlot,
} from "../../clients/inventory-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { controllerIcon } from "../../ui/components/controller-icon";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import { commaNumber, formatMoney, groupItems } from "./bag-display";
import type { IItemActionMenu } from "./item-action-menu";
import { ItemGrouping } from "./item-grouping";

export interface BagsPanelPresentation {
	readonly bottomInset?: number;
	readonly hint?: string;
	readonly emptyText?: string;
	readonly showMoney?: boolean;
	readonly itemInteraction?: "use" | "transfer";
}

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
	private readonly icons: {
		border: Frame;
		icon: Frame;
		cooldown: Frame;
		source?: InventorySlot;
	}[] = [];
	private readonly headers: Frame[] = [];
	private readonly toggle: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private items: readonly InventoryItem[] = [];
	private readonly unsubscribeGrouping: () => void;
	private money = 0;
	private mounted = false;
	private dirty = true;
	private contentHeight = 1;
	private rendering = false;
	private renderGeneration = 0;
	private cancelRender?: () => void;
	private navGrid: NavGrid = [];
	private navigationChanged?: () => void;
	private visibilityChanged?: (visible: boolean) => void;
	refreshInteractions(): void {
		if (!this.mounted) return;
		for (const cell of this.icons) {
			const source = cell.source;
			cell.icon.setItem(
				source &&
					this.presentation.itemInteraction !== "transfer" &&
					!this.actions.hasItemUseTarget?.() &&
					this.actions.getDepositBankType?.() === undefined
					? source
					: undefined,
			);
		}
	}
	constructor(
		public readonly id: string,
		public readonly title: string,
		private readonly frame: Frame,
		private readonly pool: IFramePoolManager,
		private readonly actions: Pick<
			IInventoryClient,
			| "useItem"
			| "pickupItem"
			| "getDepositBankType"
			| "getCooldown"
			| "hasItemUseTarget"
		>,
		private readonly menu: IItemActionMenu,
		private readonly scheduler: ITaskScheduler,
		private readonly grouping: ItemGrouping = new ItemGrouping(),
		private readonly presentation: BagsPanelPresentation = {},
	) {
		this.toggle = new Frame(`${id}-group-toggle`, pool, "Button");
		this.viewport = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
		const unsubscribeGrouping = grouping.subscribe(() => {
			this.dirty = true;
			if (this.mounted) {
				this.viewport.resetScroll();
				this.render();
			}
		});
		this.unsubscribeGrouping = () => unsubscribeGrouping();
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
		setWindowTitle(this.frame, this.title);
		this.frame.setLabel(
			"actions",
			this.presentation.hint ??
				`${controllerIcon("X")} Use / Equip   ${controllerIcon("Y")} Actions`,
			"BOTTOMLEFT",
			16,
			16,
			12,
		);
		this.frame.show();
		this.toggle.setParent(this.frame);
		this.toggle.layout(180, 30, "TOPRIGHT", this.frame, -16, -24);
		this.toggle.setButtonBackground();
		this.toggle.onClick((button) => {
			if (button !== "LeftButton") return;
			this.toggleGrouping();
		});
		this.toggle.show();
		this.viewport.inset(
			this.frame,
			16,
			58,
			16,
			this.presentation.bottomInset ?? 48,
		);
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
		this.refreshCooldowns();
		this.renderMoney();
	}
	private renderMoney(): void {
		if (this.presentation.showMoney === false) return;
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
		const generation = ++this.renderGeneration;
		this.cancelRender?.();
		this.dirty = true;
		this.rendering = true;
		for (const cell of this.icons) {
			cell.icon.setItem();
			cell.icon.hideTooltip();
		}
		const jobs: (() => void)[] = [];
		const secureItems: (() => void)[] = [];
		const grid: NavGrid = [
			[
				this.toggle.navigationNode(`${this.id}-group-toggle`, () =>
					this.toggleGrouping(),
				),
			],
		];
		this.toggle.setLabel(
			"mode",
			this.grouping.mode === "category"
				? "Group: Category"
				: "Group: Expansion",
		);
		const groups = groupItems(this.items, this.grouping.mode);
		const columnBottoms = [0, 0];
		let index = 0;
		groups.forEach((group, groupIndex) => {
			const column = columnBottoms[0] <= columnBottoms[1] ? 0 : 1;
			const x = column * categorySpacing;
			const previousBottom = columnBottoms[column] ?? 0;
			const groupTop =
				previousBottom === 0
					? 0
					: Math.ceil(previousBottom / itemSpacing) * itemSpacing;
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
								"SecureButton",
							),
							cooldown: new Frame(
								`${this.id}-cooldown-${cellIndex}`,
								this.pool,
								"Cooldown",
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
					cell.source = source;
					cell.cooldown.fill(cell.icon);
					const usesSecureItem = () =>
						source !== undefined &&
						this.presentation.itemInteraction !== "transfer" &&
						!this.actions.hasItemUseTarget?.() &&
						this.actions.getDepositBankType?.() === undefined;
					const icon = cell.icon;
					const current = () =>
						this.mounted &&
						!this.rendering &&
						generation === this.renderGeneration;
					icon.setHoverTooltip(() =>
						current() ? (source?.hyperlink ?? item.itemId) : undefined,
					);
					secureItems.push(() =>
						icon.setItem(usesSecureItem() ? source : undefined),
					);
					const top =
						groupTop + 28 + Math.floor(itemIndex / itemsPerRow) * itemSpacing;
					const row = 1 + Math.floor(top / itemSpacing);
					// Lua array iteration visits gaps, so retain them as empty rows.
					while (grid.length <= row) grid.push([]);
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
						true,
					);
					cells.push({
						...node,
						secureActions: () => ({
							alternate: current() && usesSecureItem() ? icon : undefined,
							alternateButton: "RightButton",
						}),
						navigationScroll: this.viewport,
						tooltipItem: () =>
							current() ? (source?.hyperlink ?? item.itemId) : undefined,
						onAlternate: () => {
							if (current() && source && !usesSecureItem())
								this.actions.useItem(source);
						},
						onContext: () => {
							if (current() && source) this.menu.open(source);
						},
						navColumn: column * itemsPerRow + (itemIndex % itemsPerRow),
					});
					cell.icon.onPostClick((button) => {
						if (
							current() &&
							source &&
							!usesSecureItem() &&
							button === "RightButton"
						)
							this.actions.useItem(source);
					});
					cell.icon.onDragStart(() => {
						if (current() && source) this.actions.pickupItem(source);
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
					cell.cooldown.show();
				});
			});
			columnBottoms[column] =
				groupTop +
				28 +
				Math.ceil(group.items.length / itemsPerRow) * itemSpacing +
				14;
		});
		this.contentHeight = Math.max(1, ...columnBottoms);
		this.layoutContent();
		this.content.setLabel(
			"empty",
			groups.length === 0
				? (this.presentation.emptyText ?? "Your bags are empty")
				: "",
			"TOPLEFT",
			0,
			-10,
		);
		for (let i = index; i < this.icons.length; i++) {
			const cell = this.icons.at(i);
			jobs.push(() => {
				cell?.border.hide();
				cell?.icon.hide();
				cell?.cooldown.hide();
				if (cell) cell.source = undefined;
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
			for (const configure of secureItems) configure();
			this.refreshCooldowns();
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
	refreshCooldowns(): void {
		if (!this.mounted || this.rendering) return;
		for (const cell of this.icons) {
			if (!cell.source) continue;
			const cooldown = this.actions.getCooldown?.(cell.source);
			cell.cooldown.setCooldown(cooldown?.start ?? 0, cooldown?.duration ?? 0);
		}
	}
	private toggleGrouping(): void {
		if (!this.mounted) return;
		this.grouping.toggle();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	onUnmount(): void {
		for (const cell of this.icons) cell.icon.setFocused(false, true);
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
		this.unsubscribeGrouping();
		this.onUnmount();
		for (const cell of this.icons) {
			cell.cooldown.destroy();
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
