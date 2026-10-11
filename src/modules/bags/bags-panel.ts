import type {
	IInventoryActions,
	InventoryItem,
} from "../../clients/inventory-client";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";
import {
	commaNumber,
	formatMoney,
	type GroupMode,
	groupItems,
} from "./bag-display";

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
export class BagsPanel implements IPanel {
	private readonly icons: { border: Frame; icon: Frame }[] = [];
	private readonly headers: Frame[] = [];
	private readonly toggle: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private items: readonly InventoryItem[] = [];
	private mode: GroupMode = "category";
	private money = 0;
	private mounted = false;
	constructor(
		public readonly id: string,
		public readonly title: string,
		private readonly frame: Frame,
		private readonly pool: IFramePoolManager,
		private readonly actions: IInventoryActions,
	) {
		this.toggle = new Frame(`${id}-group-toggle`, pool, "Button");
		this.viewport = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
	}
	setItems(items: readonly InventoryItem[]): void {
		this.items = items;
		if (this.mounted) this.render();
	}
	setMoney(copper: number): void {
		this.money = copper;
		if (this.mounted) this.renderMoney();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Bags requires a frame parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.frame.show();
		this.toggle.setParent(this.frame);
		this.toggle.layout(180, 30, "TOPLEFT", this.frame, 16, -16);
		this.toggle.setColor(0.15, 0.18, 0.24);
		this.toggle.onClick((button) => {
			if (button !== "LeftButton") return;
			this.mode = this.mode === "category" ? "expansion" : "category";
			this.viewport.resetScroll();
			this.render();
		});
		this.toggle.show();
		this.viewport.inset(this.frame, 16, 58, 16, 48);
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.viewport.show();
		this.content.show();
		this.mounted = true;
		this.render();
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
		this.toggle.setLabel(
			"mode",
			this.mode === "category" ? "Group: Category" : "Group: Expansion",
		);
		const groups = groupItems(this.items, this.mode);
		let y = 0;
		let index = 0;
		groups.forEach((group, groupIndex) => {
			let header = this.headers.at(groupIndex);
			if (!header) {
				header = new Frame(`${this.id}-header-${groupIndex}`, this.pool);
				this.headers.push(header);
			}
			header.setParent(this.content);
			header.layout(460, 24, "TOPLEFT", this.content, 0, -y);
			header.setLabel("title", group.label, "LEFT", 0, 0, 15, 460);
			header.show();
			y += 28;
			group.items.forEach((item, itemIndex) => {
				let cell = this.icons.at(index);
				if (!cell) {
					cell = {
						border: new Frame(`${this.id}-border-${index}`, this.pool),
						icon: new Frame(`${this.id}-icon-${index}`, this.pool, "Button"),
					};
					this.icons.push(cell);
				}
				cell.border.setParent(this.content);
				cell.border.layout(
					42,
					42,
					"TOPLEFT",
					this.content,
					(itemIndex % 10) * 46,
					-y - Math.floor(itemIndex / 10) * 46,
				);
				const color = qualityColors.at(item.quality) ?? ([1, 1, 1] as const);
				cell.border.setColor(...color);
				cell.icon.setParent(cell.border);
				cell.icon.layout(38, 38, "CENTER", cell.border);
				cell.icon.setIcon(item.iconFileId);
				const source = item.sources.at(0);
				cell.icon.onClick((button) => {
					if (this.mounted && source && button === "RightButton")
						this.actions.useItem(source);
				});
				cell.icon.onDragStart(() => {
					if (this.mounted && source) this.actions.pickupItem(source);
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
				index++;
			});
			y += Math.ceil(group.items.length / 10) * 46 + 14;
		});
		this.content.layout(460, Math.max(1, y), "TOPLEFT", this.viewport);
		this.viewport.clampScroll();
		this.content.setLabel(
			"empty",
			groups.length === 0 ? "Your bags are empty" : "",
			"TOPLEFT",
			0,
			-10,
		);
		for (let i = index; i < this.icons.length; i++) {
			this.icons.at(i)?.border.hide();
			this.icons.at(i)?.icon.hide();
		}
		for (let i = groups.length; i < this.headers.length; i++)
			this.headers.at(i)?.hide();
	}
	onUnmount(): void {
		this.mounted = false;
		this.frame.hide();
	}
	getNavGrid(): [] {
		return [];
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
