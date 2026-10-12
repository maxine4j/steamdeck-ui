import type {
	DungeonRole,
	DungeonSection,
	IDungeonFinderClient,
} from "../../clients/dungeon-finder-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

const sections: readonly { id: DungeonSection; label: string }[] = [
	{ id: "special", label: "Special events & Timewalking" },
	{ id: "heroic", label: "Heroic random" },
	{ id: "normal", label: "Normal random" },
];

export class DungeonFinderPanel implements IPanel {
	readonly id = "dungeon-finder";
	readonly title = "Dungeon Finder";
	readonly icon = 237538;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IDungeonFinderClient,
		close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 30,
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private render(): void {
		const dungeons = this.client.getDungeons();
		const selected = this.client.getSelected();
		const queued = this.client.isQueued();
		const rows: ListRow[] = [];
		for (const section of sections) {
			const entries = dungeons.filter(
				(dungeon) => dungeon.section === section.id,
			);
			if (entries.length === 0) continue;
			rows.push({
				id: `heading-${section.id}`,
				label: section.label,
				heading: true,
				marginBottom: 8,
				activate: () => {},
			});
			entries.forEach((dungeon, index) => {
				rows.push({
					id: `dungeon-${dungeon.id}`,
					label: dungeon.name,
					selected: selected === dungeon.id,
					detail: !dungeon.available
						? "Unavailable for you or your party"
						: selected === dungeon.id
							? "Selected"
							: "Select dungeon",
					marginBottom: index === entries.length - 1 ? 20 : 4,
					activate: () => {
						if (queued || !dungeon.available) return;
						this.client.select(dungeon.id);
						this.refresh();
					},
				});
			});
		}
		if (dungeons.length === 0)
			rows.push({
				id: "empty",
				label: "No random dungeons available",
				heading: true,
				marginBottom: 20,
				activate: () => {},
			});
		rows.push({
			id: "heading-queue",
			label: "Queue",
			heading: true,
			marginBottom: 8,
			activate: () => {},
		});
		const roles = this.client.getRoles();
		for (const role of [
			"tank",
			"healer",
			"damage",
		] as const satisfies readonly DungeonRole[]) {
			rows.push({
				id: `role-${role}`,
				label:
					role === "tank" ? "Tank" : role === "healer" ? "Healer" : "Damage",
				selected: roles[role],
				detail: queued
					? "Roles locked while queued"
					: roles[role]
						? "Selected role"
						: "Select role",
				activate: () => {
					this.client.toggleRole(role);
					this.refresh();
				},
			});
		}
		rows.push({
			id: "queue-action",
			label: queued ? "Leave queue" : "Find a group",
			detail: queued
				? "Currently queued"
				: "Choose a dungeon and at least one role",
			activate: () => {
				if (queued) this.client.leave();
				else this.client.join();
				this.refresh();
			},
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
