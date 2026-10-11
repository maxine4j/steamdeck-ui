import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

/** The Bags module's one-bag presentation. */
export class BagsPanel implements IPanel {
	private readonly icons: Frame[] = [];
	private items: readonly { readonly iconFileId: number }[] = [];
	private mounted = false;
	constructor(
		public readonly id: string,
		public readonly title: string,
		private readonly frame: Frame,
		private readonly pool: IFramePoolManager,
	) {}
	setItems(items: readonly { readonly iconFileId: number }[]): void {
		this.items = items;
		if (this.mounted) this.render();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Item grid requires a frame component parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.frame.show();
		this.mounted = true;
		this.render();
	}
	private render(): void {
		const columns = Math.min(10, this.items.length);
		const rows = columns > 0 ? Math.ceil(this.items.length / columns) : 0;
		for (let index = 0; index < this.items.length; index++) {
			let icon = this.icons.at(index);
			if (!icon) {
				icon = new Frame(`${this.id}-icon-${index}`, this.pool);
				this.icons.push(icon);
			}
			icon.setParent(this.frame);
			icon.layout(
				40,
				40,
				"CENTER",
				this.frame,
				((index % columns) - (columns - 1) / 2) * 44,
				((rows - 1) / 2 - Math.floor(index / columns)) * 44,
			);
			const item = this.items.at(index);
			if (item) icon.setIcon(item.iconFileId);
			icon.show();
		}
		for (let index = this.items.length; index < this.icons.length; index++)
			this.icons.at(index)?.hide();
	}
	onUnmount(): void {
		this.mounted = false;
		for (const icon of this.icons) icon.hide();
		this.frame.hide();
	}
	getNavGrid(): [] {
		return [];
	}
	destroy(): void {
		this.onUnmount();
		for (const icon of this.icons) icon.destroy();
		this.icons.length = 0;
		this.frame.destroy();
	}
}
