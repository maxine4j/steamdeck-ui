import type {
	DungeonListId,
	DungeonRole,
	DungeonSection,
	IDungeonFinderClient,
} from "../../clients/dungeon-finder-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import { IconCheckbox } from "../../ui/components/icon-checkbox";
import type { IModal } from "../../ui/components/modal";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { setWindowTitle } from "../../ui/components/window-title";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

const pages = [
	{
		id: "dungeons",
		label: "Dungeons",
		icon: "Interface\\Icons\\INV_Helmet_08",
	},
	{ id: "raids", label: "Raids", icon: "Interface\\LFGFrame\\UI-LFR-PORTRAIT" },
	{ id: "pvp", label: "PvP", icon: "Interface\\Icons\\achievement_bg_winwsg" },
	{
		id: "premades",
		label: "Premade Groups",
		icon: "Interface\\Icons\\Achievement_General_StayClassy",
	},
] as const;
type FinderPage = (typeof pages)[number]["id"] | DungeonListId;

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
	{ role: "tank", label: "Tank", icon: "UI-LFG-RoleIcon-Tank" },
	{
		role: "healer",
		label: "Healer",
		icon: "UI-LFG-RoleIcon-Healer",
	},
	{ role: "damage", label: "Damage", icon: "UI-LFG-RoleIcon-DPS" },
	{
		role: "leader",
		label: "Request Leader",
		icon: "UI-LFG-RoleIcon-Leader",
	},
];

const searchingEye = {
	atlas: "groupfinder-eye-flipbook-searching",
	rows: 8,
	columns: 11,
	frames: 80,
	duration: 2,
};

function queueTile(queued: boolean) {
	return {
		height: 60,
		backgroundAtlas: "ui-journeys-renown-button",
		backgroundSlice: 16,
		backgroundTint: queued ? ([0.2, 0.8, 0.3] as const) : undefined,
		animatedIcon: queued ? searchingEye : undefined,
	};
}

function actionTile(
	row: ListRow,
	queued: boolean,
	label = "Queue",
	actionTooltip?: string,
	counter?: string,
): ListRow {
	const start = row.label.indexOf("(");
	let end = -1;
	for (let index = row.label.length - 1; index > start; index--) {
		if (row.label.charAt(index) === ")") {
			end = index;
			break;
		}
	}
	const split = start >= 0 && end > start;
	const name = split
		? [row.label.slice(0, start).trim(), row.label.slice(end + 1).trim()]
				.filter((part) => part !== "")
				.join(" ")
		: row.label;
	return {
		...row,
		...queueTile(queued),
		label: counter ? `${name} • ${counter}` : name,
		detail: split ? row.label.slice(start, end + 1) : undefined,
		tooltip: row.enabled === false ? row.tooltip : row.label,
		activate: () => {},
		secondary: {
			label: queued ? "Leave Queue" : label,
			width: 110,
			height: 32,
			onlyAction: true,
			tooltip:
				actionTooltip ??
				(queued
					? "In queue - leave?"
					: label === "Queue"
						? undefined
						: "Choose Dungeons"),
			activate: row.activate,
		},
	};
}

export class DungeonFinderPanel implements IPanel {
	readonly id = "dungeon-finder";
	readonly title = "Dungeon Finder";
	readonly iconAtlas = "UI-HUD-MicroMenu-Groupfinder-Up";
	private readonly list: ScrollList;
	private readonly frame: Frame;
	private readonly container: Frame;
	private readonly back: Frame;
	private readonly checkboxes: IconCheckbox[];
	private mounted = false;
	private page?: FinderPage;
	private rolesMounted = false;
	private readonly update: DeferredRefresh;
	private navigationChanged?: () => void;
	private pendingLeave?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IDungeonFinderClient,
		close: () => void,
		scheduler: ITaskScheduler,
		private readonly confirmation: IModal,
	) {
		this.frame = new Frame(`${this.id}-root`, pool);
		this.container = new Frame(`${this.id}-container`, pool);
		this.back = new Frame("dungeon-back", pool, "Button");
		this.checkboxes = roleControls.map(
			({ role, label, icon }) =>
				new IconCheckbox(`role-${role}`, pool, label, icon, () => {
					if (!this.mounted || !this.hasRoles() || this.client.isQueued())
						return;
					this.client.toggleRole(role);
					this.refresh();
				}),
		);
		this.update = new DeferredRefresh(scheduler, () => this.render());
		this.list = new ScrollList(this.id, pool, "", close, {
			padding: 30,
			contentPadding: { horizontal: 24, vertical: 10 },
			centerSingleLine: true,
			centerText: false,
			centerLabelsVertically: true,
			centerContent: true,
			buttonWidth: 420,
			top: 52,
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
	private dismissLeave(): void {
		this.pendingLeave = undefined;
		this.confirmation.close();
	}
	private confirmLeave(leave: () => void, stillQueued: () => boolean): void {
		const confirm = () => {
			if (!this.mounted || this.pendingLeave !== confirm) return;
			this.dismissLeave();
			if (!stillQueued()) return;
			leave();
			this.refresh();
		};
		this.pendingLeave = confirm;
		this.confirmation.open("Leave Queue?", [
			{
				id: "cancel",
				label: "Stay in Queue",
				select: () => this.dismissLeave(),
			},
			{ id: "leave", label: "Leave Queue", select: confirm },
		]);
	}
	private confirmDungeonLeave(id: number | DungeonListId): void {
		this.confirmLeave(
			() => this.client.leave(),
			() => this.client.isQueued() && this.client.getSelected() === id,
		);
	}
	private landingRows(): ListRow[] {
		return pages.map<ListRow>(({ id, label, icon }) => ({
			id: `page-${id}`,
			label,
			icon,
			iconSize: 66,
			iconRing: {
				atlas: "bluemenu-Ring",
				size: 95,
				maskAtlas: "CircleMaskScalable",
			},
			backgroundTexture: {
				file: "Interface\\Common\\bluemenu-main",
				coords: [0.00390625, 0.87890625, 0.75195313, 0.83007813],
			},
			height: 96,
			fontSize: 18,
			marginBottom: 16,
			activate: () => {
				if (!this.mounted || this.page) return;
				this.page = id;
				this.list.resetScroll();
				this.refresh();
			},
		}));
	}
	private dungeonRows(): ListRow[] {
		const dungeons = this.client.getDungeons();
		const selected = this.client.getSelected();
		const queued = this.client.isQueued();
		const rows: ListRow[] = [
			{
				id: "heading-dungeons",
				label: "Dungeons",
				icon: pages.at(0)?.icon,
				iconSize: 32,
				height: 40,
				heading: true,
				fontSize: 22,
				marginTop: 16,
				marginBottom: 16,
				activate: () => {},
			},
		];
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
				rows.push(
					actionTile(
						{
							id: `dungeon-${dungeon.id}`,
							label: dungeon.name,
							enabled: queued ? selected === dungeon.id : dungeon.available,
							tooltip:
								queued && selected === dungeon.id
									? "Leave Queue"
									: dungeon.name,
							marginBottom: index === entries.length - 1 ? 20 : 4,
							activate: () => {
								if (
									!this.mounted ||
									this.page !== "dungeons" ||
									(!this.client.isQueued() && !dungeon.available)
								)
									return;
								if (this.client.isQueued()) {
									if (this.client.getSelected() !== dungeon.id) return;
									this.confirmDungeonLeave(dungeon.id);
									return;
								} else {
									this.client.select(dungeon.id);
									this.client.join();
								}
								this.refresh();
							},
						},
						queued && selected === dungeon.id,
					),
				);
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
			id: "heading-specific-dungeons",
			label: "Specific dungeons",
			heading: true,
			indent: 24,
			fontSize: 18,
			marginBottom: 8,
			activate: () => {},
		});
		for (const list of this.client.getDungeonLists()) {
			rows.push(
				actionTile(
					{
						id: `list-${list.id}`,
						label: list.label,
						enabled: !queued || selected === list.id,
						marginBottom: 0,
						activate: () => {
							if (
								!this.mounted ||
								this.page !== "dungeons" ||
								(this.client.isQueued() &&
									this.client.getSelected() !== list.id)
							)
								return;
							if (this.client.isQueued()) {
								this.confirmDungeonLeave(list.id);
								return;
							}
							this.client.selectList(list.id);
							this.page = list.id;
							this.list.resetScroll();
							this.refresh();
						},
					},
					queued && selected === list.id,
					"Choose",
				),
			);
		}
		return rows;
	}
	private raidRows(): ListRow[] {
		const rows: ListRow[] = [
			{
				id: "heading-raids",
				label: "Raid Finder",
				icon: pages.at(1)?.icon,
				iconSize: 32,
				height: 40,
				heading: true,
				fontSize: 22,
				marginTop: 20,
				marginBottom: 16,
				activate: () => {},
			},
		];
		const raids = this.client.getRaids();
		const capacity = this.client.canQueueRaid();
		for (const raid of raids) {
			const group = {
				id: `raid-${raid.id}`,
				// LFG reward artwork uses the left 330px of a padded 512x256 canvas.
				cover: {
					width: 330,
					height: 256,
					coords: [0, 330 / 512, 0, 1] as const,
				},
				texture:
					raid.background ??
					"Interface\\LFGFrame\\UI-LFG-BACKGROUND-QUESTPAPER",
			};
			rows.push({
				id: `raid-${raid.id}`,
				group,
				label: raid.name,
				indent: 24,
				heading: true,
				fontSize: 18,
				marginTop: 16,
				marginBottom: 8,
				activate: () => {},
			});
			raid.wings.forEach((wing, index) => {
				const progress = `${wing.bosses.filter((boss) => boss.killed).length}/${wing.bosses.length}`;
				const bossTooltip = `${wing.name}\n\n${progress} bosses killed\n${wing.bosses.map((boss) => `${boss.name}${boss.killed ? " (killed)" : ""}`).join("\n")}`;
				rows.push({
					...actionTile(
						{
							id: `wing-${wing.id}`,
							label: wing.name,
							enabled: wing.queued || (wing.available && capacity),
							tooltip: wing.queued
								? "Leave Queue"
								: !capacity
									? "Raid Finder queue limit reached"
									: wing.name,
							marginBottom: index === raid.wings.length - 1 ? 20 : 0,
							activate: () => {
								if (!this.mounted || this.page !== "raids") return;
								const current = this.client
									.getRaids()
									.find((entry) => entry.id === raid.id)
									?.wings.find((entry) => entry.id === wing.id);
								if (!current) return;
								if (current.queued) {
									this.confirmLeave(
										() => this.client.leaveRaid(wing.id),
										() =>
											this.client
												.getRaids()
												.some((entry) =>
													entry.wings.some(
														(candidate) =>
															candidate.id === wing.id && candidate.queued,
													),
												),
									);
									return;
								} else if (current.available && this.client.canQueueRaid())
									this.client.joinRaid(wing.id);
								this.refresh();
							},
						},
						wing.queued,
						"Queue",
						bossTooltip,
						progress,
					),
					group,
					backgroundAtlas: undefined,
					backgroundSlice: undefined,
					backgroundTint: undefined,
					background: wing.queued ? [0.1, 0.3, 0.15] : false,
				});
			});
		}
		if (raids.length === 0)
			rows.push({
				id: "empty-raids",
				label: "No raids available",
				heading: true,
				activate: () => {},
			});
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
		if (page === "follower" && choices.length > 0)
			rows.push({
				id: "difficulty-follower",
				label: "Follower Dungeons",
				heading: true,
				activate: () => {},
			});
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
		const queued = this.client.isQueued();
		rows.push(
			actionTile(
				{
					id: "queue-action",
					label:
						this.client.getDungeonLists().find((list) => list.id === page)
							?.label ?? "Find Dungeon",
					enabled: queued
						? this.client.getSelected() === page
						: choices.some((dungeon) => dungeon.checked && dungeon.available),
					tooltip: queued ? "Leave Queue" : undefined,
					activate: () => {
						if (!this.mounted || this.page !== page) return;
						if (this.client.isQueued()) {
							if (this.client.getSelected() !== page) return;
							this.confirmDungeonLeave(page);
							return;
						} else if (
							this.client
								.getDungeonChoices(page)
								.some((dungeon) => dungeon.checked && dungeon.available)
						)
							this.client.join();
						this.refresh();
					},
				},
				queued && this.client.getSelected() === page,
			),
		);
		return rows;
	}
	private hasRoles(): boolean {
		return (
			this.page === undefined ||
			this.page === "dungeons" ||
			this.page === "raids" ||
			this.page === "specific" ||
			this.page === "follower"
		);
	}
	private render(): void {
		if (this.page) this.back.show();
		else this.back.hide();
		const rows =
			this.page === undefined
				? this.landingRows()
				: this.page === "dungeons"
					? this.dungeonRows()
					: this.page === "raids"
						? this.raidRows()
						: this.page === "specific" || this.page === "follower"
							? this.choiceRows(this.page)
							: [];
		setWindowTitle(
			this.frame,
			this.page
				? (this.client.getDungeonLists().find((list) => list.id === this.page)
						?.label ??
						pages.find((page) => page.id === this.page)?.label ??
						this.title)
				: this.title,
		);
		if (this.hasRoles() !== this.rolesMounted) {
			this.rolesMounted = this.hasRoles();
			this.checkboxes.forEach((control, index) => {
				if (this.rolesMounted)
					control.mount(this.frame, 30 + index * 108, 70, false);
				else control.unmount();
			});
		}
		if (this.rolesMounted) {
			const roles = this.client.getRoles();
			const availableRoles = this.client.getAvailableRoles();
			const queued = this.client.isQueued();
			roleControls.forEach(({ role }, index) => {
				this.checkboxes
					.at(index)
					?.setChecked(roles[role], !queued && availableRoles[role]);
			});
		}
		this.list.setRows(rows);
	}
	onBack(): void {
		if (!this.mounted || !this.page) return;
		this.dismissLeave();
		this.page =
			this.page === "specific" || this.page === "follower"
				? "dungeons"
				: undefined;
		this.list.resetScroll();
		this.refresh();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Dungeon finder requires a frame parent");
		this.frame.fill(parent);
		this.frame.setWindowBackground();
		this.container.inset(this.frame, 16, 180, 16, 16);
		this.container.setInsetBackground();
		this.container.show();
		this.list.setWidth(this.container.getSize().width);
		this.container.onSizeChanged(() => {
			if (this.mounted) this.list.setWidth(this.container.getSize().width);
		});
		this.list.mount(this.container);
		this.back.setParent(this.container);
		this.back.layout(96, 26, "TOPLEFT", this.container, 12, -12);
		this.back.setButtonBackground();
		this.back.setLabel("label", "‹ Back", "CENTER", 0, 0, 13);
		this.back.onClick(() => this.onBack());
		this.frame.show();
		this.mounted = true;
		this.refresh();
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.dismissLeave();
		this.mounted = false;
		this.update.setActive(false);
		this.list.unmount();
		this.back.hide();
		for (const control of this.checkboxes) control.unmount();
		this.rolesMounted = false;
		this.frame.hide();
		this.container.hide();
		this.container.onSizeChanged(undefined);
	}
	getNavGrid() {
		const availableRoles =
			this.mounted && this.hasRoles() && !this.client.isQueued()
				? this.client.getAvailableRoles()
				: undefined;
		return this.mounted
			? [
					this.checkboxes.filter((_control, index) => {
						const role = roleControls.at(index)?.role;
						return role !== undefined && availableRoles?.[role];
					}),
					...(this.page
						? [[this.back.navigationNode("dungeon-back", () => this.onBack())]]
						: []),
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
		this.container.destroy();
		this.back.destroy();
	}
}
