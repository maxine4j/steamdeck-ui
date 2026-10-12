import type {
	Achievement,
	AchievementCategory,
	AchievementSummary,
	IAchievementsClient,
} from "../../clients/achievements-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { Frame } from "../../ui/components/frame";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { INavigable } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";

const gold = [0.7, 0.55, 0.15] as const;
export class AchievementsPanel implements IPanel {
	readonly id = "achievements";
	readonly title = "Achievements";
	readonly icon = 133158;
	private readonly frame: Frame;
	private readonly sidebar: Frame;
	private readonly body: Frame;
	private readonly filter: Frame;
	private readonly closeButton: Frame;
	private readonly categoriesList: ScrollList;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private mounted = false;
	private category?: number;
	private incomplete = false;
	private expanded?: number;
	private categories: AchievementCategory[] = [];
	private summary?: AchievementSummary;
	private navigationChanged?: () => void;
	private readonly filterNav: INavigable;
	private readonly closeNav: INavigable;
	constructor(
		pool: IFramePoolManager,
		private readonly client: IAchievementsClient,
		private readonly close: () => void,
		scheduler: ITaskScheduler,
	) {
		this.frame = new Frame("achievements", pool);
		this.sidebar = new Frame("achievements-sidebar", pool);
		this.body = new Frame("achievements-body", pool);
		this.filter = new Frame("achievements-filter", pool, "Button");
		this.closeButton = new Frame("achievements-close", pool, "Button");
		this.update = new DeferredRefresh(scheduler, () => this.load());
		const changed = () => this.navigationChanged?.();
		this.categoriesList = new ScrollList(
			"achievements-categories",
			pool,
			"Categories",
			close,
			{
				width: 280,
				background: false,
				scheduler,
				showClose: false,
				onChanged: changed,
			},
		);
		this.list = new ScrollList("achievements-list", pool, "", close, {
			width: 820,
			autoHeight: true,
			background: false,
			showClose: false,
			top: 12,
			scheduler,
			onChanged: (complete) => {
				changed();
				if (complete && this.expanded !== undefined)
					this.list.revealRow(`achievement-${this.expanded}`);
			},
		});
		this.filterNav = {
			navId: "achievements-filter",
			navColumn: 0,
			onFocus: () => this.filter.setColor(0.3, 0.25, 0),
			onBlur: () => this.filter.setColor(0.1, 0.1, 0.1),
			onInteract: () => {
				this.incomplete = !this.incomplete;
				this.expanded = undefined;
				this.render();
			},
		};
		this.closeNav = {
			navId: "achievements-close",
			navColumn: 1,
			onFocus: () => this.closeButton.setColor(0.3, 0.25, 0),
			onBlur: () => this.closeButton.setColor(0.1, 0.1, 0.1),
			onInteract: () => this.close(),
		};
	}
	refresh(): void {
		this.update.invalidate();
	}
	private load(): void {
		this.categories = this.client.categories();
		this.summary = this.client.summary();
		this.render();
	}
	selectCategory(id?: number): void {
		this.category = id;
		this.expanded = undefined;
		this.render();
	}
	selectAchievement(id: number): void {
		const selected = this.client.selection(id);
		this.category = this.client.categoryFor(selected);
		this.incomplete = false;
		this.expanded = selected;
		if (this.summary) this.render();
		else this.refresh();
	}
	private renderCategories(): void {
		const selected = this.categories.find((c) => c.id === this.category);
		const parent = selected?.parent === -1 ? selected.id : selected?.parent;
		this.categoriesList.setRows([
			{
				id: "achievements-summary",
				label: "Summary",
				selected: this.category === undefined,
				activate: () => this.selectCategory(),
			},
			...this.categories
				.filter((c) => c.parent === -1 || c.parent === parent)
				.map((c) => ({
					id: `category-${c.id}`,
					label: `${c.parent === -1 && this.categories.some((child) => child.parent === c.id) ? (parent === c.id ? "− " : "+ ") : ""}${c.name}`,
					indent: c.parent === -1 ? 0 : 16,
					selected: c.id === this.category,
					activate: () => this.selectCategory(c.id),
				})),
		]);
	}
	private achievementRows(achievements: Achievement[]): ListRow[] {
		return achievements.flatMap((a) => {
			const rows: ListRow[] = [
				{
					id: `achievement-${a.id}`,
					label: `${this.expanded === a.id ? "−" : "+"} ${a.name} • ${a.points} points${a.completed ? ` • ${a.date}` : ""}`,
					icon: a.icon,
					selected: a.completed,
					detail: `${a.description}${a.reward !== "" ? `\nReward: ${a.reward}` : ""}`,
					tooltip: a.description,
					activate: () => {
						if (this.category === undefined) this.selectAchievement(a.id);
						else {
							this.expanded = this.expanded === a.id ? undefined : a.id;
							this.render();
						}
					},
				},
			];
			if (this.expanded !== a.id) return rows;
			const chain = this.client.chain(a.id);
			if (chain.length > 0)
				return [
					...rows,
					...chain.map((step) => ({
						id: `chain-${step.id}`,
						label: `${step.name} • ${step.points} points • ${step.date}`,
						icon: step.icon,
						indent: 24,
						activate: () => this.selectAchievement(step.id),
					})),
				];
			this.client.criteria(a.id).forEach((criterion, index) => {
				rows.push({
					id: `criterion-${a.id}-${index}`,
					label: `${criterion.completed ? "✓" : "−"} ${criterion.name}`,
					detail:
						criterion.progress || criterion.required > 1
							? criterion.text ||
								`${criterion.quantity} / ${criterion.required}`
							: "",
					indent: 24,
					progress: criterion.progress
						? {
								value:
									criterion.required > 0
										? criterion.quantity / criterion.required
										: 0,
								color: gold,
							}
						: undefined,
					activate: () => {
						if (criterion.achievement)
							this.selectAchievement(criterion.achievement);
					},
				});
			});
			return rows;
		});
	}
	private render(): void {
		if (!this.summary || !this.mounted) return;
		this.renderCategories();
		const summary = this.summary;
		this.frame.setLabel(
			"overall",
			`${summary.points} points • ${summary.totals.completed} / ${summary.totals.total} achievements`,
			"TOPLEFT",
			20,
			-46,
			16,
		);
		this.filter.setLabel(
			"label",
			`${this.incomplete ? "[x]" : "[ ]"} Only show incomplete`,
		);
		let rows: ListRow[];
		if (this.category === undefined) {
			this.frame.setLabel("selected", "Summary", "TOPLEFT", 320, -46, 16);
			rows = [
				{
					id: "summary-progress",
					label: "Overall progress",
					detail: `${summary.totals.completed} / ${summary.totals.total}`,
					progress: {
						value:
							summary.totals.total > 0
								? summary.totals.completed / summary.totals.total
								: 0,
						color: gold,
					},
					activate: () => {},
				},
				{
					id: "recent-heading",
					label: "Recent achievements",
					heading: true,
					activate: () => {},
				},
				...this.achievementRows(summary.recent),
				{
					id: "progress-heading",
					label: "Achievements earned",
					heading: true,
					activate: () => {},
				},
				...summary.categories.map((c) => ({
					id: `summary-category-${c.id}`,
					label: c.name,
					detail: `${c.completed} / ${c.total}`,
					progress: {
						value: c.total > 0 ? c.completed / c.total : 0,
						color: gold,
					},
					activate: () => this.selectCategory(c.id),
				})),
			];
		} else {
			const all = this.client.achievements(this.category, false);
			const totals = this.client.totals(this.category);
			const points = all.reduce(
				(sum, a) => sum + (a.completed ? a.points : 0),
				0,
			);
			const name =
				this.categories.find((c) => c.id === this.category)?.name ??
				"Achievements";
			this.frame.setLabel(
				"selected",
				`${name} • ${points} points • ${totals.completed} / ${totals.total}`,
				"TOPLEFT",
				320,
				-46,
				16,
			);
			rows = this.achievementRows(
				this.incomplete ? this.client.achievements(this.category, true) : all,
			);
			if (!rows.length)
				rows = [
					{
						id: "empty",
						label: "No achievements to display",
						heading: true,
						activate: () => {},
					},
				];
		}
		this.list.setRows(rows);
		this.navigationChanged?.();
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Achievements requires a frame parent");
		this.frame.fill(parent);
		this.frame.setBlackBackground();
		this.frame.setLabel("title", this.title, "TOPLEFT", 20, -16, 22);
		const width = parent.getSize().width;
		this.sidebar.inset(this.frame, 12, 90, Math.max(12, width - 292), 12);
		this.list.setWidth(Math.max(280, width - 320));
		this.body.inset(this.frame, 308, 90, 12, 12);
		this.filter.setParent(this.frame);
		this.filter.layout(250, 28, "TOPRIGHT", this.frame, -52, -12);
		this.filter.onClick(() => this.filterNav.onInteract());
		this.filter.show();
		this.closeButton.setParent(this.frame);
		this.closeButton.layout(28, 28, "TOPRIGHT", this.frame, -12, -12);
		this.closeButton.setLabel("label", "X");
		this.closeButton.onClick(this.close);
		this.closeButton.show();
		this.frame.show();
		this.sidebar.show();
		this.body.show();
		this.mounted = true;
		this.categoriesList.mount(this.sidebar);
		this.list.mount(this.body);
		this.update.setActive(true);
	}
	onUnmount(): void {
		this.mounted = false;
		this.update.setActive(false);
		this.categoriesList.unmount();
		this.list.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.close();
	}
	getNavGrid(): INavigable[][] {
		if (!this.mounted) return [];
		const left = this.categoriesList.getNavGrid();
		const right = this.list.getNavGrid();
		const rows: INavigable[][] = [[this.filterNav, this.closeNav]];
		for (let index = 0; index < Math.max(left.length, right.length); index++) {
			const l = left.at(index)?.at(0);
			const r = right.at(index)?.at(0);
			if (l) l.navColumn = 0;
			if (r) r.navColumn = 1;
			rows.push([...(l ? [l] : []), ...(r ? [r] : [])]);
		}
		return rows;
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.categoriesList.destroy();
		this.list.destroy();
		this.filter.destroy();
		this.closeButton.destroy();
		this.sidebar.destroy();
		this.body.destroy();
		this.frame.destroy();
	}
}
