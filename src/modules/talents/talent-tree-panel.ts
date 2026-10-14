import type { ITalentTreeClient } from "../../clients/talent-tree-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class TalentTreePanel implements IPanel {
	readonly id = "talent-tree";
	readonly title = "Talents";
	private readonly host: Frame;
	private readonly update: DeferredRefresh;
	private parent?: Frame;
	private mounted = false;
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITalentTreeClient,
		scheduler: ITaskScheduler,
		private readonly close: () => void,
	) {
		this.host = new Frame("talent-tree-host", pool);
		this.update = new DeferredRefresh(scheduler, () =>
			this.navigationChanged?.(),
		);
	}
	onMount(parent: IUIComponent): void {
		this.host.inset(parent as Frame, 0, 0, 0, 0);
		this.host.show();
		this.parent = parent as Frame;
		this.parent.onSizeChanged(() => {
			this.client.resize();
			this.refresh();
		});
		this.mounted = true;
		this.client.mount(this.host);
		this.update.setActive(true);
	}
	onUnmount(): void {
		if (!this.mounted) return;
		this.mounted = false;
		this.update.setActive(false);
		this.parent?.onSizeChanged();
		this.parent = undefined;
		this.client.unmount();
		this.host.hide();
	}
	refresh(): void {
		this.update.invalidate();
	}
	getNavGrid() {
		return this.client.navigation();
	}
	onBack(): void {
		if (this.client.dismissChoices()) this.refresh();
		else this.close();
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.host.destroy();
	}
}
