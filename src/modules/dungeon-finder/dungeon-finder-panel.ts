import type {
	DungeonListId,
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

const sections: readonly { id: DungeonSection; label: string; icon: string }[] =
	[
		{
			id: "special",
			label: "Special events",
			icon: "|A:ui-hud-calendar-1-up:20:20|a",
		},
		{
			id: "heroic",
			label: "Heroic random",
			icon: "|TInterface\\LFGFrame\\UI-LFG-ICON-HEROIC:20:16:0:0:32:32:0:16:0:20|t",
		},
		{
			id: "normal",
			label: "Normal random",
			icon: "|TInterface\\Icons\\Achievement_Dungeon_UlduarRaid_Archway_01:20:20|t",
		},
	];

const roleControls: readonly {
	role: DungeonRole;
	label: string;
	icon: string;
}[] = [
	{ role: "tank", label: "Tank", icon: "|A:roleicon-tiny-tank:28:28:0:0|a" },
	{
		role: "healer",
		label: "Healer",
		icon: "|A:roleicon-tiny-healer:28:28:0:0|a",
	},
	{ role: "damage", label: "Damage", icon: "|A:roleicon-tiny-dps:28:28:0:0|a" },
	{
		role: "leader",
		label: "Request Leader",
		icon: "|TInterface\\GroupFrame\\UI-Group-LeaderIcon:28:28|t",
	},
];

const searchingEye = {
	atlas: "groupfinder-eye-flipbook-searching",
	rows: 8,
	columns: 11,
	frames: 80,
	duration: 2,
};

export class DungeonFinderPanel implements IPanel {
	readonly id = "dungeon-finder";
	readonly title = "Dungeon Finder";
	readonly icon = 1100023;
	private readonly list: ScrollList;
	private readonly frame: Frame;
	private readonly checkboxes: IconCheckbox[];
	private mounted = false;
	private page?: DungeonListId;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IDungeonFinderClient,
		close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.frame = new Frame(`${this.id}-root`, pool);
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
			top: 144,
			bottom: 30,
			background: false,
			scheduler,
			onChanged: (complete) => {
				// Intermediate batches omit controls that are still being rebuilt.
				if (complete) this.navigationChanged?.();
			},
		});
	}
	refresh(): void {
		this.update.invalidate();
	}
	private overviewRows(): ListRow[] {
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
				label: `${section.icon} ${section.label}`,
				heading: true,
				marginBottom: 8,
				activate: () => {},
			});
			entries.forEach((dungeon, index) => {
				rows.push({
					id: `dungeon-${dungeon.id}`,
					label: dungeon.name,
					enabled: queued ? selected === dungeon.id : dungeon.available,
					background:
						queued && selected === dungeon.id ? [0.05, 0.25, 0.5] : undefined,
					animatedIcon:
						queued && selected === dungeon.id ? searchingEye : undefined,
					height: 32,
					tooltip:
						queued && selected === dungeon.id ? "Leave Queue" : dungeon.name,
					detail: undefined,
					marginBottom: index === entries.length - 1 ? 20 : 4,
					activate: () => {
						if (
							!this.mounted ||
							this.page ||
							(!this.client.isQueued() && !dungeon.available)
						)
							return;
						if (this.client.isQueued()) {
							if (this.client.getSelected() !== dungeon.id) return;
							this.client.leave();
						} else {
							this.client.select(dungeon.id);
							this.client.join();
						}
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
		for (const list of this.client.getDungeonLists()) {
			rows.push({
				id: `list-${list.id}`,
				label: list.label,
				fontSize: 18,
				detail: "Choose dungeons  ›",
				enabled: !queued || selected === list.id,
				background:
					queued && selected === list.id ? [0.05, 0.25, 0.5] : undefined,
				animatedIcon: queued && selected === list.id ? searchingEye : undefined,
				marginBottom: 20,
				activate: () => {
					if (
						!this.mounted ||
						this.page ||
						(this.client.isQueued() && this.client.getSelected() !== list.id)
					)
						return;
					if (!this.client.isQueued()) this.client.selectList(list.id);
					this.page = list.id;
					this.list.resetScroll();
					this.refresh();
				},
			});
		}
		return rows;
	}
	private choiceRows(page: DungeonListId): ListRow[] {
		const choices = this.client.getDungeonChoices(page);
		const ordered =
			page === "specific"
				? [
						...choices.filter((dungeon) => dungeon.difficulty === "heroic"),
						...choices.filter((dungeon) => dungeon.difficulty === "normal"),
					]
				: choices;
		const rows: ListRow[] = [];
		let difficulty: string | undefined;
		ordered.forEach((dungeon, index) => {
			if (page === "specific" && difficulty !== dungeon.difficulty) {
				difficulty = dungeon.difficulty;
				rows.push({
					id: `difficulty-${difficulty}`,
					label: difficulty === "heroic" ? "Heroic" : "Normal",
					heading: true,
					activate: () => {},
				});
			}
			rows.push({
				id: `choice-${dungeon.id}`,
				label: dungeon.name,
				checked: dungeon.checked,
				enabled: dungeon.available && !this.client.isQueued(),
				height: 24,
				tooltip: dungeon.available
					? dungeon.name
					: `${dungeon.name}: Unavailable for you or your party`,
				marginBottom: index === ordered.length - 1 ? 28 : 4,
				activate: () => {
					if (
						!this.mounted ||
						this.page !== page ||
						this.client.isQueued() ||
						!dungeon.available
					)
						return;
					this.client.toggleDungeon(page, dungeon.id);
					this.refresh();
				},
			});
		});
		if (choices.length === 0)
			rows.push({
				id: "empty-choices",
				label: "No dungeons available",
				heading: true,
				marginBottom: 28,
				activate: () => {},
			});
		rows.push({
			id: "dungeon-back",
			label: "Back",
			background: [0.18, 0.14, 0.04],
			activate: () => {
				if (this.page === page) this.onBack();
			},
		});
		const queued = this.client.isQueued();
		rows.push({
			id: "queue-action",
			label: queued ? "Leave Queue" : "Find Dungeon",
			enabled: queued
				? this.client.getSelected() === page
				: choices.some((dungeon) => dungeon.checked && dungeon.available),
			background: queued ? [0.05, 0.25, 0.5] : [0.3, 0.22, 0.06],
			animatedIcon: queued ? searchingEye : undefined,
			activate: () => {
				if (!this.mounted || this.page !== page) return;
				if (this.client.isQueued()) {
					if (this.client.getSelected() !== page) return;
					this.client.leave();
				} else if (
					this.client
						.getDungeonChoices(page)
						.some((dungeon) => dungeon.checked && dungeon.available)
				)
					this.client.join();
				this.refresh();
			},
		});
		return rows;
	}
	private render(): void {
		const queued = this.client.isQueued();
		const rows = this.page ? this.choiceRows(this.page) : this.overviewRows();
		this.list.setTitle(
			this.page
				? (this.client.getDungeonLists().find((list) => list.id === this.page)
						?.label ?? this.title)
				: this.title,
		);
		const roles = this.client.getRoles();
		const availableRoles = this.client.getAvailableRoles();
		roleControls.forEach(({ role }, index) => {
			this.checkboxes
				.at(index)
				?.setChecked(roles[role], !queued && availableRoles[role]);
		});
		this.list.setRows(rows);
	}
	onBack(): void {
		if (!this.mounted || !this.page) return;
		this.page = undefined;
		this.list.resetScroll();
		this.refresh();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Dungeon finder requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		this.list.mount(this.frame);
		this.checkboxes.forEach((control, index) => {
			control.mount(this.frame, 30 + index * 108, 70, false);
		});
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
		const availableRoles =
			this.mounted && !this.client.isQueued()
				? this.client.getAvailableRoles()
				: undefined;
		return this.mounted
			? [
					this.checkboxes.filter((_control, index) => {
						const role = roleControls.at(index)?.role;
						return role !== undefined && availableRoles?.[role];
					}),
					...this.list.getNavGrid(),
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
		this.frame.destroy();
	}
}
