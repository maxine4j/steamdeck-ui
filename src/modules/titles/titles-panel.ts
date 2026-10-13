import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { ITitlesClient } from "../../clients/titles-client";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class TitlesPanel implements IPanel {
	readonly id = "titles";
	readonly title = "Titles";
	readonly icon = 133759;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITitlesClient,
		close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 30,
			columns: 2,
			gap: 12,
			centerSingleLine: true,
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private render(): void {
		this.list.updateRows(
			this.client.getTitles().map((title) => ({
				id: `title-${title.id}`,
				label: title.selected
					? `|TInterface\\RaidFrame\\ReadyCheck-Ready:16:16|t ${title.name}`
					: title.name,
				selected: title.selected,
				background: title.selected
					? ([0.18, 0.28, 0.38] as const)
					: ([0.1, 0.12, 0.16] as const),
				activate: () => {
					this.client.select(title.id);
					this.refresh();
				},
			})),
		);
	}
	onMount(parent: IUIComponent): void {
		this.list.mount(parent);
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.update.setActive(false);
		this.list.unmount();
	}
	getNavGrid() {
		return this.list.getNavGrid();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.update.setActive(false);
		this.list.destroy();
	}
}
