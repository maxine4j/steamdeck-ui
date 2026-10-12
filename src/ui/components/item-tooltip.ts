import type { ApplicationEvent, IEventBus } from "../../events/types";
import type { WowFrame } from "../../types";
import type { FrameType, IFramePoolManager } from "../frame-pool-manager";

type NativeTooltip = WowFrame & {
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
	shouldRefreshData?: boolean;
	RefreshData(): void;
	SetScript(
		script: "OnUpdate",
		handler?: (this: void, frame: WowFrame, elapsed: number) => void,
	): void;
};

/** UI helpers are not part of the generated game API surface. */
declare global {
	function GameTooltip_ShowCompareItem(this: void, tooltip: WowFrame): void;
}

/** Non-interactive item details for the currently focused navigation node. */
export class ItemTooltip {
	private tooltips: NativeTooltip[] = [];
	private item?: string | number;
	private elapsed = 0;
	private layoutKey?: string;
	private readonly refresh = () => this.setItem(this.item);
	private readonly refreshEvents: ApplicationEvent[] = [
		"PLAYER_EQUIPMENT_CHANGED",
		"ITEM_DATA_LOAD_RESULT",
	];
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly events: IEventBus,
	) {
		for (const event of this.refreshEvents)
			events.subscribe(event, this.refresh);
	}
	setItem(item: string | number | undefined): void {
		this.item = item;
		this.layoutKey = undefined;
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
		main.SetScript("OnUpdate", (_frame, elapsed) => {
			this.elapsed += elapsed;
			if (this.elapsed < 0.2) return;
			this.elapsed = 0;
			if (main.shouldRefreshData) {
				main.RefreshData();
				GameTooltip_ShowCompareItem(main);
				this.layoutKey = undefined;
			}
			this.layout();
		});
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
		const key = `${screen.GetWidth()}:${screen.GetHeight()}:${visible.map((tooltip) => `${tooltip.GetWidth()}x${tooltip.GetHeight()}`).join(",")}`;
		if (key === this.layoutKey) return;
		this.layoutKey = key;
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
		for (const event of this.refreshEvents)
			this.events.unsubscribe(event, this.refresh);
		this.setItem(undefined);
		this.tooltips.forEach((tooltip, index) => {
			tooltip.ClearLines();
			tooltip.SetScale(1);
			tooltip.SetScript("OnUpdate", undefined);
			tooltip.SetFrameStrata("PARENT");
			tooltip.shoppingTooltips = undefined;
			tooltip.suppressAutomaticCompareItem = false;
			const type: FrameType = index === 0 ? "GameTooltip" : "ShoppingTooltip";
			this.pool.release(type, tooltip);
		});
		this.tooltips = [];
	}
}
