import type {
	DungeonRole,
	DungeonSection,
	IDungeonFinderClient,
} from "../../clients/dungeon-finder-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import { IconCheckbox } from "../../ui/components/icon-checkbox";
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

const roleControls: readonly {
	role: DungeonRole;
	label: string;
	icon: string;
}[] = [
	{ role: "tank", label: "Tank", icon: "|A:roleicon-tiny-tank:40:40:0:0|a" },
	{
		role: "healer",
		label: "Healer",
		icon: "|A:roleicon-tiny-healer:40:40:0:0|a",
	},
	{ role: "damage", label: "Damage", icon: "|A:roleicon-tiny-dps:40:40:0:0|a" },
	{
		role: "leader",
		label: "Request Leader",
		icon: "|TInterface\\GroupFrame\\UI-Group-LeaderIcon:40:40|t",
	},
];

export class DungeonFinderPanel implements IPanel {
	readonly id = "dungeon-finder";
	readonly title = "Dungeon Finder";
	readonly icon = 237538;
	private readonly list: ScrollList;
	private readonly frame: Frame;
	private readonly action: Frame;
	private readonly checkboxes: IconCheckbox[];
	private mounted = false;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IDungeonFinderClient,
		close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.frame = new Frame(`${this.id}-root`, pool);
		this.action = new Frame("queue-action", pool, "Button");
		this.checkboxes = roleControls.map(
			({ role, label, icon }) =>
				new IconCheckbox(`role-${role}`, pool, label, icon, () => {
					if (!this.mounted || this.client.isQueued()) return;
					this.client.toggleRole(role);
					this.refresh();
				}),
		);
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, this.title, close, {
			padding: 30,
			top: 190,
			bottom: 120,
			background: false,
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
		const roles = this.client.getRoles();
		roleControls.forEach(({ role }, index) => {
			this.checkboxes.at(index)?.setChecked(roles[role], !queued);
		});
		this.action.setLabel(
			"action",
			queued ? "Leave Queue" : "Find Dungeon",
			"CENTER",
			0,
			0,
			20,
		);
		this.list.setRows(rows);
	}
	private activateQueue(): void {
		if (!this.mounted) return;
		if (this.client.isQueued()) this.client.leave();
		else this.client.join();
		this.refresh();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Dungeon finder requires a frame parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.list.mount(this.frame);
		this.checkboxes.forEach((control, index) => {
			control.mount(this.frame, 30 + index * 108, 70);
		});
		this.action.setParent(this.frame);
		this.action.layout(420, 56, "BOTTOM", this.frame, 0, 30);
		this.action.setColor(0.3, 0.22, 0.06);
		this.action.setBorder([1, 0.82, 0, 1]);
		this.action.onClick((button) => {
			if (button === "LeftButton") this.activateQueue();
		});
		this.action.show();
		this.frame.show();
		this.mounted = true;
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.mounted = false;
		this.update.setActive(false);
		this.list.unmount();
		for (const control of this.checkboxes) control.unmount();
		this.frame.hide();
	}
	getNavGrid() {
		return this.mounted
			? [
					this.checkboxes,
					...this.list.getNavGrid(),
					[
						this.action.navigationNode("queue-action", () =>
							this.activateQueue(),
						),
					],
				]
			: [];
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		for (const control of this.checkboxes) control.destroy();
		this.action.destroy();
		this.frame.destroy();
	}
}
