import type { WowFrame } from "../../types";
import type { FrameType, IFramePoolManager } from "../frame-pool-manager";

interface NativeTooltip extends WowFrame {
	SetOwner(owner: WowFrame, anchor: string): void;
	SetHyperlink(link: string): void;
	ClearLines(): void;
	SetScale(scale: number): void;
	EnableMouse(enabled: boolean): void;
	IsShown(): boolean;
	GetWidth(): number;
	GetHeight(): number;
	shoppingTooltips?: NativeTooltip[];
	suppressAutomaticCompareItem?: boolean;
}

/** UI helpers are not part of the generated game API surface. */
declare global {
	function GameTooltip_ShowCompareItem(this: void, tooltip: WowFrame): void;
}

/** Non-interactive item details for the currently focused navigation node. */
export class ItemTooltip {
	private tooltips: NativeTooltip[] = [];
	constructor(private readonly pool: IFramePoolManager) {}
	setItem(item: string | number | undefined): void {
		for (const tooltip of this.tooltips) tooltip.Hide();
		if (item === undefined) return;
		if (this.tooltips.length === 0) {
			for (const type of [
				"GameTooltip",
				"ShoppingTooltip",
				"ShoppingTooltip",
			] as const) {
				const tooltip = this.pool.acquire(type) as NativeTooltip;
				tooltip.SetParent(UIParent);
				// This overlay owns no input and never takes navigation focus.
				tooltip.SetFrameStrata("TOOLTIP");
				tooltip.EnableMouse(false);
				this.tooltips.push(tooltip);
			}
		}
		const main = this.tooltips.at(0);
		if (!main) return;
		for (const tooltip of this.tooltips) {
			tooltip.ClearLines();
			tooltip.SetScale(1);
		}
		main.shoppingTooltips = this.tooltips.slice(1);
		main.SetOwner(UIParent, "ANCHOR_NONE");
		main.suppressAutomaticCompareItem = true;
		main.ClearAllPoints();
		main.SetPoint("TOP", UIParent, "TOP", 0, -32);
		main.SetHyperlink(typeof item === "number" ? `item:${item}` : item);
		main.Show();
		// Blizzard supplies equipped headers, paired-weapon rules and colored stat deltas.
		GameTooltip_ShowCompareItem(main);
		this.layout();
	}
	private layout(): void {
		const screen = UIParent as WowFrame & {
			GetWidth(): number;
			GetHeight(): number;
		};
		const visible = this.tooltips.filter((tooltip) => tooltip.IsShown());
		const width =
			visible.reduce((sum, tooltip) => sum + tooltip.GetWidth(), 0) +
			Math.max(0, visible.length - 1) * 8;
		const height = visible.reduce(
			(max, tooltip) => Math.max(max, tooltip.GetHeight()),
			1,
		);
		// Reserve the side panels and their tabs where possible; narrow screens retain readable content.
		const availableWidth = Math.min(
			screen.GetWidth() - 32,
			Math.max(480, screen.GetWidth() - 1120),
		);
		const scale = Math.min(
			1,
			availableWidth / Math.max(1, width),
			(screen.GetHeight() - 64) / (height + 22),
		);
		let x = -width / 2;
		for (const tooltip of visible) {
			tooltip.SetScale(scale);
			tooltip.ClearAllPoints();
			tooltip.SetPoint("TOPLEFT", UIParent, "TOP", x, -32 / scale);
			x += tooltip.GetWidth() + 8;
		}
	}
	destroy(): void {
		this.setItem(undefined);
		this.tooltips.forEach((tooltip, index) => {
			tooltip.ClearLines();
			tooltip.SetScale(1);
			tooltip.shoppingTooltips = undefined;
			tooltip.suppressAutomaticCompareItem = false;
			const type: FrameType = index === 0 ? "GameTooltip" : "ShoppingTooltip";
			this.pool.release(type, tooltip);
		});
		this.tooltips = [];
	}
}
