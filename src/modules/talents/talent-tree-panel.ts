import type { ITalentTreeClient } from "../../clients/talent-tree-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationChanged } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

export class TalentTreePanel implements IPanel {
	readonly id = "talent-tree";
	readonly title = "Talents";
	private readonly host: Frame;
	private readonly window: Frame;
	private readonly closeButton: Frame;
	private readonly update: DeferredRefresh;
	private parent?: Frame;
	private mounted = false;
	private active = false;
	private navigationChanged?: NavigationChanged;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITalentTreeClient,
		scheduler: ITaskScheduler,
		private readonly close: () => void,
	) {
		this.window = new Frame("talent-tree-window", pool);
		this.host = new Frame("talent-tree-host", pool);
		this.closeButton = new Frame("talent-tree-close", pool, "Button");
		this.update = new DeferredRefresh(scheduler, () =>
			this.navigationChanged?.(),
		);
	}
	onMount(parent: IUIComponent): void {
		this.parent = parent as Frame;
		this.window.setParent(this.parent);
		this.window.setWindowBackground();
		setWindowTitle(this.window, this.title);
		this.layout();
		this.window.show();
		this.host.inset(this.window, 8, 32, 8, 8);
		this.host.show();
		this.closeButton.setParent(this.window);
		this.closeButton.layout(24, 24, "TOPRIGHT", this.window, -2, -2);
		this.closeButton.setCloseButtonBackground();
		this.closeButton.onClick(() => this.close());
		this.closeButton.show();
		this.parent.onSizeChanged(() => {
			this.layout();
			this.client.resize();
			this.refresh();
		});
		this.mounted = true;
		this.client.mount(this.host);
		this.update.invalidate();
		this.update.setActive(true);
	}
	private layout(): void {
		if (!this.parent) return;
		const available = this.parent.getSize();
		const content = this.client.presentation({
			width: Math.max(1, available.width - 16),
			height: Math.max(1, available.height - 40),
		});
		this.window.layout(
			content.width + 16,
			content.height + 40,
			"CENTER",
			this.parent,
		);
	}
	onActiveChanged(active: boolean): void {
		this.active = active;
		this.window.setFocusBorder(this.mounted && this.active);
	}
	onUnmount(): void {
		if (!this.mounted) return;
		this.mounted = false;
		this.onActiveChanged(false);
		this.update.setActive(false);
		this.parent?.onSizeChanged();
		this.parent = undefined;
		this.client.unmount();
		this.host.hide();
		this.closeButton.hide();
		this.window.hide();
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
	setNavigationChanged(callback?: NavigationChanged): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.host.destroy();
		this.closeButton.destroy();
		this.window.destroy();
	}
}
