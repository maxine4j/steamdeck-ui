import type { IFramePoolManager } from "../frame-pool-manager";
import type { INavigable } from "../navigation/types";
import { Frame } from "./frame";
import { type ListRow, ScrollList } from "./scroll-list";
export class Dropdown {
	readonly button: Frame;
	private readonly popup: Frame;
	private readonly list: ScrollList;
	private open = false;
	private parent?: Frame;
	constructor(id: string, pool: IFramePoolManager) {
		this.button = new Frame(id, pool, "Button");
		this.popup = new Frame(`${id}-popup`, pool);
		this.list = new ScrollList(`${id}-options`, pool, "Filters", () =>
			this.hide(),
		);
	}
	mount(parent: Frame): void {
		this.parent = parent;
		this.button.setParent(parent);
		this.button.layout(112, 32, "TOPRIGHT", parent, -16, -66);
		this.button.setColor(0.15, 0.15, 0.15);
		this.button.setLabel("label", "Filters v");
		this.button.onClick(() => this.toggle());
		this.button.show();
	}
	setOptions(rows: ListRow[]): void {
		this.list.setRows(rows);
	}
	private toggle(): void {
		if (this.open) {
			this.hide();
			return;
		}
		if (!this.parent) return;
		this.popup.setParent(this.parent);
		this.popup.layout(456, 360, "TOPLEFT", this.parent, 12, -104);
		this.popup.show();
		this.list.mount(this.popup);
		this.open = true;
	}
	hide(): void {
		this.list.unmount();
		this.popup.hide();
		this.open = false;
	}
	getNavGrid(): INavigable[][] {
		return [
			[
				{
					navId: this.button.id,
					onFocus: () => this.button.setColor(0.3, 0.25, 0),
					onBlur: () => this.button.setColor(0.15, 0.15, 0.15),
					onInteract: () => this.toggle(),
				},
			],
			...(this.open ? this.list.getNavGrid() : []),
		];
	}
	isOpen(): boolean {
		return this.open;
	}
	destroy(): void {
		this.list.destroy();
		this.popup.destroy();
		this.button.destroy();
	}
}
