import type { ITalentsClient } from "../../clients/talents-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

const roleIcons = new Map<string, string>([
	["DAMAGER", "|A:roleicon-tiny-dps:16:16:0:0|a"],
	["TANK", "|A:roleicon-tiny-tank:16:16:0:0|a"],
	["HEALER", "|A:roleicon-tiny-healer:16:16:0:0|a"],
]);

export class TalentsPanel implements IPanel {
	readonly id = "talents";
	readonly title = "Talents";
	readonly icon = 136243;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	private error?: { id: string; text: string };
	constructor(
		pool: IFramePoolManager,
		private readonly client: ITalentsClient,
		close: () => void,
		scheduler: ITaskScheduler,
		private readonly onHidden?: () => void,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 20,
			contentPadding: { horizontal: 16, vertical: 10 },
			centerSingleLine: true,
			verticallyCentered: true,
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private activate(id: string, action: () => string | undefined): void {
		const text = action();
		this.error = text ? { id, text } : undefined;
		this.refresh();
	}
	private render(): void {
		const data = this.client.read();
		const rows: ListRow[] = data.specs.map(
			(spec): ListRow => ({
				id: `talents-spec-${spec.id}`,
				label: spec.name,
				icon: spec.icon,
				height: 64,
				detail: `${roleIcons.get(spec.role) ?? ""} ${spec.selected ? "Active specialization" : "Switch specialization"}`,
				marginBottom:
					spec === data.specs.at(-1) &&
					(data.loadouts.length > 0 || data.starterAvailable)
						? 24
						: undefined,
				selected: spec.selected,
				activate: () =>
					this.activate(`talents-spec-${spec.id}`, () =>
						this.client.selectSpec(spec.id),
					),
			}),
		);
		const specID = data.specID;
		rows.unshift({
			id: "talents-specializations-heading",
			label: "Specializations",
			heading: true,
			activate: () => {},
		});
		if (specID !== undefined) {
			rows.push({
				id: "talents-loadouts-heading",
				label: "Loadouts",
				heading: true,
				activate: () => {},
			});
			for (const loadout of data.loadouts)
				rows.push({
					id: `talents-loadout-${loadout.id}`,
					label: loadout.name,
					detail: loadout.selected ? "Active loadout" : undefined,
					selected: loadout.selected,
					activate: () =>
						this.activate(`talents-loadout-${loadout.id}`, () =>
							this.client.selectLoadout(specID, loadout.id),
						),
				});
			if (data.starterAvailable)
				rows.push({
					id: "talents-starter",
					label: "Starter build",
					selected: data.starterSelected,
					detail: data.starterSelected ? "Active loadout" : undefined,
					activate: () =>
						this.activate("talents-starter", () =>
							this.client.selectStarter(specID),
						),
				});
		}
		this.list.setRows(
			rows.map((row) =>
				this.error?.id === row.id ? { ...row, detail: this.error.text } : row,
			),
		);
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
