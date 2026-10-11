import type { IReputationClient } from "../../clients/reputation-client";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class ReputationPanel implements IPanel {
	readonly id = "reputation";
	readonly title = "Reputation";
	readonly icon = 133784;
	private readonly list: ScrollList;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IReputationClient,
		close: () => void,
	) {
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 20,
		});
	}
	refresh(): void {
		this.list.setRows(
			this.client.getReputations().map((reputation) => ({
				id: `reputation-${reputation.index}`,
				label: `${reputation.header ? (reputation.collapsed ? "+ " : "− ") : ""}${reputation.name}`,
				fontSize: reputation.header ? (reputation.child ? 16 : 18) : 14,
				indent: reputation.header
					? reputation.child
						? 16
						: 0
					: reputation.child
						? 32
						: 16,
				detail: `${reputation.standing} ${reputation.progress}${reputation.watched ? " • Watched" : ""}`,
				tooltip: reputation.description,
				selected: reputation.watched,
				activate: () => {
					this.client.activate(reputation);
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
