import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { ITitlesClient } from "../../clients/titles-client";
import { Frame } from "../../ui/components/frame";
import { ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationChanged } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

export class TitlesPanel implements IPanel {
	readonly id = "titles";
	readonly title = "Titles";
	readonly icon = 133759;
	private readonly list: ScrollList;
	private readonly back: Frame;
	private readonly update: DeferredRefresh;
	private navigationChanged?: NavigationChanged;
	private selectedId?: string;
	private cancelInitialFocus?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITitlesClient,
		private readonly close: () => void,
		private readonly scheduler: ITaskScheduler,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.back = new Frame("titles-back", pool, "Button");
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 30,
			top: 112,
			columns: 2,
			gap: 12,
			centerSingleLine: true,
			scheduler,
			onChanged: () => this.navigationChanged?.(this.selectedId),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private render(): void {
		const titles = this.client.getTitles();
		const selected = titles.find((title) => title.selected);
		this.selectedId = selected ? `title-${selected.id}` : undefined;
		this.list.updateRows(
			titles.map((title) => ({
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
					this.close();
				},
			})),
		);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Titles requires a frame parent");
		this.list.mount(parent);
		this.back.setParent(parent);
		this.back.layout(96, 26, "TOPLEFT", parent, 16, -82);
		this.back.setButtonBackground();
		this.back.setLabel("label", "‹ Back", "CENTER", 0, 0, 13);
		this.back.onClick(() => this.onBack());
		this.back.show();
		this.update.setActive(true);
		if (this.selectedId) {
			this.cancelInitialFocus = this.scheduler.nextFrame(() => {
				this.cancelInitialFocus = undefined;
				this.navigationChanged?.(this.selectedId);
			});
		}
	}
	onUnmount(): void {
		this.cancelInitialFocus?.();
		this.cancelInitialFocus = undefined;
		this.update.setActive(false);
		this.list.unmount();
		this.back.hide();
	}
	onBack(): void {
		this.close();
	}
	getNavGrid() {
		return [
			[this.back.navigationNode("titles-back", () => this.onBack())],
			...this.list.getNavGrid(),
		];
	}
	setNavigationChanged(callback?: NavigationChanged): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.cancelInitialFocus?.();
		this.update.setActive(false);
		this.list.destroy();
		this.back.destroy();
	}
}
