import type {
	IVendorClient,
	VendorActions,
	VendorItem,
} from "../../clients/vendor-client";
import { Frame } from "../../ui/components/frame";
import {
	type GridGroup,
	type GridItem,
	ItemGrid,
} from "../../ui/components/item-grid";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable, NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

function price(copper: number): string {
	return `${Math.floor(copper / 10000)}g ${Math.floor(copper / 100) % 100}s ${copper % 100}c`;
}

export class VendorPanel implements IPanel {
	readonly title: string;
	readonly icon: number;
	private readonly frame: Frame;
	private readonly grid: ItemGrid;
	private readonly footer: Frame;
	private readonly controls: {
		frame: Frame;
		nav: INavigable;
		key: "repair" | "guildRepair" | "sellJunk";
		label: string;
		icon: number;
		action: () => void;
	}[];
	private mounted = false;
	private dirty = true;
	private navigationChanged?: () => void;
	private actions: VendorActions = {
		repairCost: 0,
		repair: false,
		guildRepair: false,
		sellJunk: false,
	};
	constructor(
		readonly id: "vendor" | "buyback",
		pool: IFramePoolManager,
		private readonly client: IVendorClient,
		private readonly close: () => void,
	) {
		this.title = id === "vendor" ? "Vendor" : "Buyback";
		this.icon = id === "vendor" ? 133784 : 133786;
		this.frame = new Frame(`${id}-root`, pool);
		this.grid = new ItemGrid(
			`${id}-items`,
			pool,
			id === "vendor" ? "No items for sale" : "No items to buy back",
		);
		this.footer = new Frame(`${id}-footer`, pool);
		this.controls = [
			{
				key: "repair" as const,
				label: "Repair all",
				icon: 134520,
				action: () => client.repair(false),
			},
			{
				key: "guildRepair" as const,
				label: "Guild repair",
				icon: 132060,
				action: () => client.repair(true),
			},
			{
				key: "sellJunk" as const,
				label: "Sell junk",
				icon: 134400,
				action: () => client.sellJunk(),
			},
		].map((control) => {
			const frame = new Frame(`${id}-${control.key}`, pool, "Button");
			return {
				...control,
				frame,
				nav: {
					navId: frame.id,
					mouseTarget: frame,
					onFocus: () => frame.setLabel("focus", ">", "BOTTOM", 0, 0),
					onBlur: () => frame.setLabel("focus", ""),
					onInteract: () => this.activate(control.key, control.action),
				},
			};
		});
	}
	private activate(
		key: "repair" | "guildRepair" | "sellJunk",
		action: () => void,
	): void {
		if (this.mounted && this.actions[key]) {
			action();
			this.refresh();
		}
	}
	refresh(): void {
		this.dirty = true;
		if (this.mounted) this.render();
	}
	private render(): void {
		const items =
			this.id === "vendor" ? this.client.getItems() : this.client.getBuyback();
		const groups: GridGroup[] = [];
		const pageSize = this.id === "vendor" ? 10 : 12;
		const pages = new Map<number, GridItem[]>();
		for (const item of items) {
			const page = Math.floor((item.index - 1) / pageSize) + 1;
			let tiles = pages.get(page);
			if (!tiles) {
				tiles = [];
				pages.set(page, tiles);
			}
			tiles.push(this.tile(item));
		}
		for (const [page, tiles] of pages) {
			groups.push({
				id: `page-${page}`,
				label: this.id === "vendor" ? `Page ${page}` : undefined,
				items: tiles,
			});
		}
		this.grid.setGroups(groups);
		if (this.id === "vendor") {
			this.actions = this.client.getActions();
			this.footer.setLabel(
				"cost",
				`Repair cost: ${price(this.actions.repairCost)}`,
				"TOPLEFT",
				12,
				-8,
				12,
			);
			for (const control of this.controls) {
				this.footer.setLabel(
					control.key,
					this.actions[control.key]
						? control.label
						: `|cff808080${control.label}|r`,
					"TOPLEFT",
					12 + this.controls.indexOf(control) * 148,
					-28,
					12,
				);
				control.frame.setTooltip(
					`${control.label}${this.actions[control.key] ? "" : " (unavailable)"}`,
				);
			}
		}
		this.dirty = false;
		this.navigationChanged?.();
	}
	private tile(item: VendorItem) {
		const costs = item.costs
			.map((cost) => `${cost.count}|T${cost.icon}:12:12|t`)
			.join(" ");
		const detail = `${price(item.price)}${costs.length > 0 ? ` + ${costs}` : ""}${item.available >= 0 && this.id === "vendor" ? ` • ${item.available} left` : ""}`;
		return {
			id: `${this.id}-item-${item.index}`,
			name: `${item.name}${item.count > 1 ? ` ×${item.count}` : ""}`,
			icon: item.icon,
			hyperlink: item.hyperlink,
			detail: item.purchasable ? detail : `|cff808080${detail}|r`,
			activate: () => {
				if (!this.mounted || !item.purchasable) return;
				if (this.id === "vendor") this.client.buy(item);
				else this.client.buyback(item);
			},
		};
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Vendor requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.mounted = true;
		if (this.id === "vendor") {
			this.footer.setParent(this.frame);
			this.footer.layout(456, 120, "BOTTOMLEFT", this.frame, 16, 12);
			this.footer.setInsetBackground();
			this.controls.forEach((control, index) => {
				control.frame.setParent(this.footer);
				control.frame.layout(
					56,
					56,
					"TOPLEFT",
					this.footer,
					12 + index * 148,
					-50,
				);
				control.frame.setIcon(control.icon);
				control.frame.onClick((button) => {
					if (button === "LeftButton")
						this.activate(control.key, control.action);
				});
				control.frame.show();
			});
			this.footer.show();
		}
		this.grid.mount(this.frame, 52, this.id === "vendor" ? 144 : 16);
		if (this.dirty) this.render();
		this.frame.show();
	}
	onUnmount(): void {
		this.mounted = false;
		this.grid.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.close();
	}
	getNavGrid(): NavGrid {
		if (!this.mounted) return [];
		return [
			...this.grid.getNavGrid(),
			...(this.id === "vendor"
				? [this.controls.map((control) => control.nav)]
				: []),
		];
	}
	destroy(): void {
		this.onUnmount();
		this.grid.destroy();
		for (const control of this.controls) control.frame.destroy();
		this.footer.destroy();
		this.frame.destroy();
	}
}
