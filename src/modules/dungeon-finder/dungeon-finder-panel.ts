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

export class DungeonFinderPanel implements IPanel {
	readonly id = "dungeon-finder";
	readonly title = "Dungeon Finder";
	readonly icon = 1100023;
	private readonly list: ScrollList;
	private readonly frame: Frame;
	private readonly action: Frame;
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
	private overviewRows(): ListRow[] {
		const dungeons = this.client.getDungeons();
		const selected = this.client.getSelected();
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
					selected: selected === dungeon.id,
					detail: !dungeon.available
						? "Unavailable for you or your party"
						: selected === dungeon.id
							? "Selected"
							: "Select dungeon",
					marginBottom: index === entries.length - 1 ? 20 : 4,
					activate: () => {
						if (
							!this.mounted ||
							this.page ||
							this.client.isQueued() ||
							!dungeon.available
						)
							return;
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
		for (const list of this.client.getDungeonLists()) {
			rows.push({
				id: `list-${list.id}`,
				label: list.label,
				fontSize: 18,
				detail: "Choose dungeons  ›",
				selected: selected === list.id,
				marginBottom: 20,
				activate: () => {
					if (!this.mounted || this.page) return;
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
		const rows = choices.map<ListRow>((dungeon, index) => ({
			id: `choice-${dungeon.id}`,
			label: dungeon.name,
			checked: dungeon.checked,
			enabled: dungeon.available && !this.client.isQueued(),
			detail: dungeon.available
				? undefined
				: "Unavailable for you or your party",
			marginBottom: index === choices.length - 1 ? 28 : 4,
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
		}));
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
				if (!this.mounted || this.page !== page) return;
				this.page = undefined;
				this.list.resetScroll();
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
		const availableRoles = this.mounted
			? this.client.getAvailableRoles()
			: undefined;
		return this.mounted
			? [
					this.checkboxes.filter((_control, index) => {
						const role = roleControls.at(index)?.role;
						return role !== undefined && availableRoles?.[role];
					}),
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
