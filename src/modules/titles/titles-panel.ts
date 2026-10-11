import type { ITitlesClient } from "../../clients/titles-client";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class TitlesPanel implements IPanel {
	readonly id = "titles";
	readonly title = "Titles";
	readonly icon = 133759;
	private readonly list: ScrollList;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITitlesClient,
		close: () => void,
	) {
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 30,
		});
	}
	refresh(): void {
		this.list.setRows(
			this.client.getTitles().map((title) => ({
				id: `title-${title.id}`,
				label: title.name,
				detail: title.selected ? "Selected" : "Click to use this title",
				selected: title.selected,
				activate: () => {
					this.client.select(title.id);
					this.refresh();
				},
			})),
		);
	}
	onMount(parent: IUIComponent): void {
		this.refresh();
		this.list.mount(parent);
	}
	onUnmount(): void {
		this.list.unmount();
	}
	getNavGrid() {
		return this.list.getNavGrid();
	}
	destroy(): void {
		this.list.destroy();
	}
}
