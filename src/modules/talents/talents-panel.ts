import type { ITalentsClient } from "../../clients/talents-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class TalentsPanel implements IPanel {
	readonly id = "talents";
	readonly title = "Talents";
	readonly icon = 136243;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	private error?: string;
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITalentsClient,
		close: () => void,
		private readonly openFull: () => void,
		scheduler: ITaskScheduler,
		private readonly onHidden?: () => void,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 20,
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private activate(action: () => string | undefined): void {
		this.error = action();
		this.refresh();
	}
	private render(): void {
		const data = this.client.read();
		const rows: ListRow[] = data.specs.map(
			(spec): ListRow => ({
				id: `talents-spec-${spec.id}`,
				label: spec.name,
				icon: spec.icon,
				detail: `${spec.selected ? "Active specialization • " : "Switch specialization • "}${spec.role}`,
				selected: spec.selected,
				activate: () => this.activate(() => this.client.selectSpec(spec.id)),
			}),
		);
		const specID = data.specID;
		if (specID !== undefined) {
			for (const loadout of data.loadouts)
				rows.push({
					id: `talents-loadout-${loadout.id}`,
					label: loadout.name,
					detail: loadout.selected ? "Active loadout" : "Apply talent loadout",
					selected: loadout.selected,
					activate: () =>
						this.activate(() => this.client.selectLoadout(specID, loadout.id)),
				});
			if (data.starterAvailable)
				rows.push({
					id: "talents-starter",
					label: "Starter build",
					selected: data.starterSelected,
					detail: data.starterSelected
						? "Active loadout"
						: "Apply Blizzard starter build",
					activate: () =>
						this.activate(() => this.client.selectStarter(specID)),
				});
		}
		rows.push({
			id: "talents-full",
			label: "Open full talents",
			detail:
				this.error ??
				(data.loadouts.length === 0
					? "No saved loadouts • Edit trees and manage loadouts"
					: "Edit trees and manage loadouts"),
			tooltip:
				this.error ??
				"Open Blizzard talents to edit trees, create, import, rename or delete loadouts.",
			activate: this.openFull,
		});
		this.list.setRows(rows);
	}
	onMount(parent: IUIComponent): void {
		this.list.mount(parent);
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.update.setActive(false);
		this.list.unmount();
		this.onHidden?.();
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
