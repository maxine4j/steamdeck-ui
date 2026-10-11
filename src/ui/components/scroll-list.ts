import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { Frame } from "./frame";
import type { IUIComponent } from "./types";

export interface ListRow {
	readonly id: string;
	readonly label: string;
	readonly detail?: string;
	readonly tooltip?: string;
	readonly selected?: boolean;
	readonly activate: () => void;
}
/** Generic reusable scrollable buttons; domain data stays in module panels. */
export class ScrollList {
	private readonly frame: Frame;
	private readonly scroll: Frame;
	private readonly content: Frame;
	private readonly close: Frame;
	private readonly buttons: { frame: Frame; nav: INavigable }[] = [];
	private rows: readonly ListRow[] = [];
	private mounted = false;
	constructor(
		private readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly title: string,
		private readonly onClose: () => void,
	) {
		this.frame = new Frame(id, pool);
		this.scroll = new Frame(`${id}-scroll`, pool, "ScrollFrame");
		this.content = new Frame(`${id}-content`, pool);
		this.close = new Frame(`${id}-close`, pool, "Button");
	}
	setRows(rows: readonly ListRow[]): void {
		this.rows = rows;
		if (this.mounted) this.render();
	}
	mount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("List requires a frame parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.frame.setLabel("title", this.title, "TOPLEFT", 16, -16, 20);
		this.close.setParent(this.frame);
		this.close.layout(28, 24, "TOPRIGHT", this.frame, -12, -8);
		this.close.setLabel("close", "X");
		this.close.onClick(() => {
			if (this.mounted) this.onClose();
		});
		this.close.show();
		this.scroll.inset(this.frame, 12, 52, 12, 16);
		this.content.setParent(this.scroll);
		this.scroll.setScrollContent(this.content);
		this.scroll.show();
		this.content.show();
		this.frame.show();
		this.mounted = true;
		this.render();
	}
	private render(): void {
		this.content.layout(
			456,
			Math.max(1, this.rows.length * 52),
			"TOPLEFT",
			this.scroll,
		);
		this.rows.forEach((row, index) => {
			let button = this.buttons.at(index);
			if (!button) {
				const frame = new Frame(`${this.id}-row-${index}`, this.pool, "Button");
				button = {
					frame,
					nav: {
						navId: row.id,
						onFocus: () => frame.setColor(0.3, 0.25, 0),
						onBlur: () => this.style(index),
						onInteract: () => {
							if (this.mounted) this.rows.at(index)?.activate();
						},
					},
				};
				this.buttons.push(button);
			}
			button.nav.navId = row.id;
			button.frame.setParent(this.content);
			button.frame.layout(456, 48, "TOPLEFT", this.content, 0, -index * 52);
			button.frame.setLabel("label", row.label, "TOPLEFT", 8, -6, 14, 440);
			button.frame.setLabel(
				"detail",
				row.detail ?? "",
				"BOTTOMLEFT",
				8,
				6,
				12,
				440,
			);
			button.frame.setTooltip(row.tooltip ?? row.label);
			button.frame.onClick((mouseButton) => {
				if (this.mounted && mouseButton === "LeftButton")
					this.rows.at(index)?.activate();
			});
			this.style(index);
			button.frame.show();
		});
		for (let index = this.rows.length; index < this.buttons.length; index++)
			this.buttons.at(index)?.frame.hide();
		this.scroll.clampScroll();
	}
	private style(index: number): void {
		const color: readonly [number, number, number] = this.rows.at(index)
			?.selected
			? [0.25, 0.2, 0.05]
			: [0.08, 0.08, 0.08];
		this.buttons.at(index)?.frame.setColor(...color);
	}
	unmount(): void {
		this.mounted = false;
		this.frame.hide();
	}
	getNavGrid(): INavigable[][] {
		return this.mounted
			? this.buttons.slice(0, this.rows.length).map((button) => [button.nav])
			: [];
	}
	destroy(): void {
		this.unmount();
		for (const button of this.buttons) button.frame.destroy();
		this.buttons.length = 0;
		this.close.destroy();
		this.scroll.destroy();
		this.content.destroy();
		this.frame.destroy();
	}
}
