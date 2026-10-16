import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { Frame } from "./frame";
import { SCROLL_VIEWPORT_RIGHT } from "./scroll-indicator";
import type { TooltipContent } from "./tooltip-content";

export interface GridItem {
	readonly id: string;
	readonly name: string;
	readonly icon: number;
	readonly detail?: string;
	readonly hyperlink?: string;
	readonly tooltip?: TooltipContent;
	readonly selected?: boolean;
	readonly spell?: number;
	readonly context?: () => void;
	readonly activate: () => void;
	readonly secondary?: { readonly label: string; activate(): void };
}
export interface GridGroup {
	readonly id: string;
	readonly label?: string;
	readonly items: readonly GridItem[];
}
interface Cell {
	top: number;
	readonly frame: Frame;
	readonly icon: Frame;
	readonly secondary: Frame;
	readonly nav: INavigable;
	readonly secondaryNav: INavigable;
}
export interface ItemGridOptions {
	readonly secureIcons?: boolean;
	readonly focusIcon?: boolean;
	readonly backgroundAtlas?: string;
	readonly backgroundOpacity?: number;
	readonly outlineIcons?: boolean;
}

/** Generic grouped two-column item tiles, with pooled controls and a scroll viewport. */
export class ItemGrid {
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly cells: Cell[] = [];
	private readonly headers: Frame[] = [];
	private groups: readonly GridGroup[] = [];
	private items: readonly GridItem[] = [];
	private grid: INavigable[][] = [];
	private mounted = false;
	private contentHeight = 1;
	constructor(
		private readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly emptyText = "No items match your filters",
		private readonly options: ItemGridOptions = {},
	) {
		this.viewport = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
	}
	setGroups(groups: readonly GridGroup[]): void {
		this.groups = groups;
		if (this.mounted) this.render();
	}
	mount(parent: Frame, top = 112, bottom = 16): void {
		this.viewport.inset(parent, 16, top, SCROLL_VIEWPORT_RIGHT, bottom);
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.mounted = true;
		this.render();
	}
	private render(): void {
		const items: GridItem[] = [];
		this.grid = [];
		let y = 0;
		let headerCount = 0;
		for (const group of this.groups) {
			if (group.items.length === 0) continue;
			if (group.label !== undefined) {
				let header = this.headers.at(headerCount);
				if (!header) {
					header = new Frame(`${this.id}-header-${headerCount}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(460, 24, "TOPLEFT", this.content, 0, -y);
				header.setLabel("label", group.label, "LEFT", 0, 0, 15, 460);
				header.show();
				headerCount++;
				y += 28;
			}
			let row: INavigable[] = [];
			group.items.forEach((item, groupIndex) => {
				const index = items.length;
				items.push(item);
				let cell = this.cells.at(index);
				if (!cell) {
					const frame = new Frame(
						`${this.id}-cell-${index}`,
						this.pool,
						"Button",
					);
					const secondary = new Frame(
						`${this.id}-secondary-${index}`,
						this.pool,
						"Button",
					);
					const icon = new Frame(
						`${this.id}-icon-${index}`,
						this.pool,
						this.options.secureIcons ? "SecureButton" : "Frame",
					);
					const focus = this.options.focusIcon ? icon : frame;
					cell = {
						top: 0,
						frame,
						secondary,
						icon,
						nav: {
							navId: item.id,
							mouseTarget: this.options.secureIcons
								? {
										setNavigationFocus(callback) {
											frame.setNavigationFocus(callback);
											icon.setNavigationFocus(callback);
										},
									}
								: frame,
							navigationScroll: this.viewport,
							onFocus: (refresh) => {
								if (refresh)
									focus.setFocused(true, this.options.focusIcon ?? false, true);
								else if (this.options.focusIcon) focus.setFocused(true, true);
								else focus.setFocused(true);
								if (!refresh) this.reveal(index);
							},
							tooltipItem: () =>
								this.items.at(index)?.tooltip ??
								this.items.at(index)?.hyperlink,
							secureActions: () => ({
								alternate:
									this.mounted && this.items.at(index)?.spell
										? icon
										: undefined,
							}),
							onContext: () => {
								if (this.mounted) this.items.at(index)?.context?.();
							},
							onBlur: () => this.style(index),
							onInteract: () => {
								if (this.mounted) this.items.at(index)?.activate();
							},
						},
						secondaryNav: {
							navId: `${item.id}-secondary`,
							mouseTarget: secondary,
							navigationScroll: this.viewport,
							onFocus: (refresh) => {
								if (refresh) secondary.setFocused(true, false, true);
								else secondary.setFocused(true);
								if (!refresh) this.reveal(index);
							},
							onBlur: () => secondary.setFocused(false),
							onInteract: () => {
								if (this.mounted) this.items.at(index)?.secondary?.activate();
							},
						},
					};
					this.cells.push(cell);
				}
				cell.nav.navId = item.id;
				cell.top = y + Math.floor(groupIndex / 2) * 66;
				cell.secondaryNav.navId = `${item.id}-secondary`;
				cell.frame.setParent(this.content);
				cell.frame.layout(
					226,
					60,
					"TOPLEFT",
					this.content,
					(groupIndex % 2) * 234,
					-y - Math.floor(groupIndex / 2) * 66,
				);
				cell.icon.setParent(cell.frame);
				cell.icon.layout(44, 44, "TOPLEFT", cell.frame, 6, -8);
				cell.icon.setIcon(item.icon);
				if (this.options.outlineIcons) cell.icon.setIconOutline();
				if (this.options.secureIcons) {
					cell.icon.setSpell(item.spell);
					cell.icon.setTooltip(item.name, item.hyperlink, false);
				}
				cell.icon.show();
				const width = item.secondary ? 132 : 164;
				cell.frame.setLabel("name", item.name, "TOPLEFT", 56, -8, 12, width);
				cell.frame.setLabel(
					"detail",
					item.detail ?? "",
					"BOTTOMLEFT",
					56,
					6,
					11,
					width,
				);
				if (!this.options.secureIcons)
					cell.frame.setTooltip(item.name, item.hyperlink);
				cell.frame.onClick((button) => {
					if (!this.mounted) return;
					if (button === "LeftButton") this.items.at(index)?.activate();
					else if (button === "RightButton")
						this.items.at(index)?.secondary?.activate();
				});
				row.push(cell.nav);
				if (item.secondary) {
					cell.secondary.setParent(cell.frame);
					cell.secondary.layout(28, 28, "TOPRIGHT", cell.frame, -4, -4);
					cell.secondary.setButtonBackground();
					cell.secondary.setLabel("label", item.secondary.label);
					cell.secondary.onClick((button) => {
						if (this.mounted && button === "LeftButton")
							this.items.at(index)?.secondary?.activate();
					});
					cell.secondary.show();
					row.push(cell.secondaryNav);
				} else cell.secondary.hide();
				cell.frame.show();
				if (groupIndex % 2 === 1 || groupIndex === group.items.length - 1) {
					this.grid.push(row);
					row = [];
				}
			});
			y += Math.ceil(group.items.length / 2) * 66 + 12;
		}
		this.items = items;
		items.forEach((_item, index) => {
			this.style(index);
		});
		this.contentHeight = Math.max(1, y);
		this.content.layout(460, this.contentHeight, "TOPLEFT", this.viewport);
		this.content.setLabel(
			"empty",
			items.length === 0 ? this.emptyText : "",
			"TOPLEFT",
			0,
			-8,
		);
		for (let index = items.length; index < this.cells.length; index++)
			this.cells.at(index)?.frame.hide();
		for (let index = headerCount; index < this.headers.length; index++)
			this.headers.at(index)?.hide();
		this.viewport.clampScroll();
	}
	private reveal(index: number): void {
		const cell = this.cells.at(index);
		if (this.mounted && cell)
			this.viewport.revealVerticalRange(
				cell.top,
				cell.top + 60,
				this.contentHeight,
			);
	}
	private style(index: number): void {
		const cell = this.cells.at(index);
		if (!cell) return;
		if (this.options.focusIcon) cell.icon.setFocused(false, true);
		else cell.frame.setFocused(false);
		if (this.options.backgroundAtlas) {
			cell.frame.setAtlasBackground(this.options.backgroundAtlas);
			if (this.options.backgroundOpacity !== undefined)
				cell.frame.setBackgroundOpacity(this.options.backgroundOpacity);
		} else
			cell.frame.setButtonBackground(this.items.at(index)?.selected ?? false);
	}
	unmount(): void {
		this.mounted = false;
		this.viewport.hide();
	}
	getNavGrid(): INavigable[][] {
		return this.mounted ? this.grid : [];
	}
	destroy(): void {
		this.unmount();
		for (const cell of this.cells) {
			cell.secondary.destroy();
			cell.icon.destroy();
			cell.frame.destroy();
		}
		for (const header of this.headers) header.destroy();
		this.cells.length = 0;
		this.headers.length = 0;
		this.content.destroy();
		this.viewport.destroy();
	}
}
