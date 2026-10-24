import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { ITransmogClient } from "../../clients/transmog-client";
import { Frame } from "../../ui/components/frame";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationChanged } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

export class TransmogPanel implements IPanel {
	readonly id = "transmog";
	readonly title = "Transmogrification";
	private readonly window: Frame;
	private readonly host: Frame;
	private readonly update: DeferredRefresh;
	private parent?: Frame;
	private navigationChanged?: NavigationChanged;
	constructor(
		pool: IFramePoolManager,
		private readonly client: Pick<
			ITransmogClient,
			| "presentation"
			| "mount"
			| "resize"
			| "unmount"
			| "navigation"
			| "dismissMenus"
		>,
		scheduler: ITaskScheduler,
		private readonly close: () => void,
	) {
		this.window = new Frame("transmog-window", pool);
		this.host = new Frame("transmog-host", pool);
		this.update = new DeferredRefresh(scheduler, () =>
			this.navigationChanged?.(),
		);
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
	onMount(parent: IUIComponent): void {
		this.parent = parent as Frame;
		this.window.setParent(this.parent);
		this.window.setWindowBackground();
		setWindowTitle(this.window, this.title);
		this.layout();
		this.window.show();
		this.host.inset(this.window, 8, 32, 8, 8);
		this.host.show();
		this.parent.onSizeChanged(() => {
			this.layout();
			this.client.resize();
			this.refresh();
		});
		this.client.mount(this.host);
		this.update.setActive(true);
	}
	onUnmount(): void {
		if (!this.parent) return;
		this.update.setActive(false);
		this.onActiveChanged(false);
		this.parent.onSizeChanged();
		this.parent = undefined;
		this.client.unmount();
		this.host.hide();
		this.window.hide();
	}
	onActiveChanged(active: boolean): void {
		this.window.setFocusBorder(this.parent !== undefined && active);
	}
	refresh(): void {
		this.update.invalidate();
	}
	getNavGrid() {
		return this.client.navigation();
	}
	onBack(): void {
		if (this.client.dismissMenus()) this.refresh();
		else this.close();
	}
	setNavigationChanged(callback?: NavigationChanged): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.host.destroy();
		this.window.destroy();
	}
}
