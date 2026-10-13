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
import { setWindowTitle } from "../../ui/components/window-title";
import { DeferredRefresh } from "../../ui/deferred-refresh";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavGrid } from "../../ui/navigation/types";
import type { IPanel } from "../../ui/panel/types";
import {
	type AchievementPage,
	achievementRoot,
	buildAchievementPages,
} from "./achievement-display";
import {
	formatAchievementNumber,
	formatAchievementProgress,
} from "./achievement-format";

const gold = [0.7, 0.55, 0.15] as const;
const spacing = 46;
interface AchievementCell {
	border: Frame;
	icon: Frame;
}
export class AchievementsPanel implements IPanel {
	readonly id = "achievements";
	readonly title = "Achievements";
	readonly icon = 133158;
	private readonly frame: Frame;
	private readonly body: Frame;
	private readonly viewport: Frame;
	private readonly content: Frame;
	private readonly back: Frame;
	private readonly filter: Frame;
	private readonly list: ScrollList;
	private readonly update: DeferredRefresh;
	private readonly cells: AchievementCell[] = [];
	private readonly headers: Frame[] = [];
	private mounted = false;
	private categories: AchievementCategory[] = [];
	private entries = new Map<number, readonly Achievement[]>();
	private pages: AchievementPage[] = [];
	private summary?: AchievementSummary;
	private page?: string;
	private pendingCategory?: number;
	private expanded?: number;
	private incomplete = false;
	private loading = false;
	private scanning = false;
	private width = 468;
	private contentHeight = 1;
	private grid: NavGrid = [];
	private generation = 0;
	private renderRevision = 0;
	private cancelScan?: () => void;
	private cancelRender?: () => void;
	private navigationChanged?: () => void;
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly client: IAchievementsClient,
		private readonly close: () => void,
		private readonly scheduler: ITaskScheduler,
	) {
		this.frame = new Frame("achievements", pool);
		this.body = new Frame("achievements-body", pool);
		this.viewport = new Frame("achievements-scroll", pool, "ScrollFrame");
		this.content = new Frame("achievements-content", pool);
		this.back = new Frame("achievements-back", pool, "Button");
		this.filter = new Frame("achievements-filter", pool, "Button");
		this.list = new ScrollList("achievements-list", pool, "", close, {
			autoHeight: true,
			background: false,
			padding: 0,
			top: 0,
			bottom: 0,
			contentPadding: { horizontal: 9.2, vertical: 6.9 },
			scheduler,
			onChanged: () => this.navigationChanged?.(),
		});
		this.update = new DeferredRefresh(scheduler, () => this.load());
	}
	refresh(): void {
		this.cancelScan?.();
		this.cancelRender?.();
		this.cancelScan = undefined;
		this.cancelRender = undefined;
		this.generation++;
		this.update.invalidate();
	}
	private load(): void {
		const categories = this.client.categories();
		const summary = this.client.summary();
		const entries = new Map<number, readonly Achievement[]>();
		this.loading = this.summary === undefined;
		this.scanning = true;
		if (this.loading) {
			this.summary = summary;
			this.render();
		}
		const generation = this.generation;
		let cursor = 0;
		const step = () => {
			if (!this.mounted || generation !== this.generation) return;
			this.cancelScan = undefined;
			const category = categories.at(cursor++);
			if (category)
				entries.set(category.id, this.client.achievements(category.id, false));
			if (cursor < categories.length)
				this.cancelScan = this.scheduler.nextFrame(step);
			else {
				this.loading = false;
				this.scanning = false;
				this.categories = categories;
				this.entries = entries;
				this.summary = summary;
				this.pages = buildAchievementPages(this.categories, this.entries);
				this.resolveSelection();
				this.render();
			}
		};
		this.cancelScan = this.scheduler.nextFrame(step);
	}
	selectCategory(id?: number): void {
		this.pendingCategory = id;
		this.expanded = undefined;
		this.page = undefined;
		this.incomplete = false;
		this.resolveSelection();
		this.viewport.resetScroll();
		this.list.resetScroll();
		this.render();
	}
	private resolveSelection(): void {
		if (this.loading) return;
		if (this.expanded !== undefined) {
			this.page = this.pages.find((p) =>
				p.sections.some((s) =>
					s.groups.some((g) =>
						g.achievements.some((a) => a.id === this.expanded),
					),
				),
			)?.id;
			if (!this.page) {
				// Deep links may target an achievement hidden from normal enumeration.
				const achievement = this.client.achievement(this.expanded);
				const category = this.client.categoryFor(this.expanded);
				this.entries.set(category, [
					...(this.entries.get(category) ?? []),
					achievement,
				]);
				this.pages = buildAchievementPages(this.categories, this.entries);
				this.page = this.pages.find((p) =>
					p.sections.some((s) =>
						s.groups.some((g) =>
							g.achievements.some((a) => a.id === this.expanded),
						),
					),
				)?.id;
			}
		} else if (this.pendingCategory !== undefined) {
			const root = achievementRoot(this.categories, this.pendingCategory);
			const members = [...this.entries].flatMap(([id, achievements]) =>
				achievementRoot(this.categories, id)?.id === root?.id
					? achievements
					: [],
			);
			this.page = this.pages.find((p) =>
				p.sections.some((s) =>
					s.groups.some((g) =>
						g.achievements.some((a) =>
							members.some((member) => member.id === a.id),
						),
					),
				),
			)?.id;
		}
		this.pendingCategory = undefined;
	}
	selectAchievement(id: number): void {
		this.expanded = this.client.selection(id);
		this.incomplete = false;
		if (this.summary) {
			this.resolveSelection();
			this.render();
		} else this.refresh();
	}
	private openPage(page: string): void {
		this.page = page;
		this.expanded = undefined;
		this.incomplete = false;
		this.viewport.resetScroll();
		this.list.resetScroll();
		this.render();
	}
	onBack(): void {
		if (this.expanded !== undefined) {
			this.expanded = undefined;
			this.render();
		} else if (this.page !== undefined) this.selectCategory();
		else this.close();
	}
	private details(): ListRow[] {
		if (this.expanded === undefined) return [];
		const achievement = this.client.achievement(this.expanded);
		return [
			{
				id: "achievement-detail",
				label: achievement.name,
				icon: achievement.icon,
				detail: this.tooltip(achievement).slice(achievement.name.length + 1),
				tooltip: this.tooltip(achievement),
				fontSize: 18,
				height: 80,
				activate: () => {},
			},
			...this.client.chain(achievement.id).map((step) => ({
				id: `chain-${step.id}`,
				label: `${step.name} • ${formatAchievementNumber(step.points)} points`,
				icon: step.icon,
				detail: step.completed ? step.date : "Incomplete",
				activate: () => {
					this.expanded = step.id;
					this.render();
				},
			})),
			...this.client.criteria(achievement.id).map((criterion, index) => ({
				id: `criterion-${achievement.id}-${index}`,
				label: `${criterion.completed ? "✓" : "−"} ${criterion.name}`,
				detail: criterion.progress
					? formatAchievementProgress(criterion.quantity, criterion.required)
					: criterion.text ||
						(criterion.required > 1
							? formatAchievementProgress(
									criterion.quantity,
									criterion.required,
								)
							: ""),
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
			})),
		];
	}
	private tooltip(achievement: Achievement): string {
		return `${achievement.name}\n${formatAchievementNumber(achievement.points)} points • ${achievement.completed ? `Completed ${achievement.date}` : "Incomplete"}\n${achievement.description}${achievement.reward !== "" ? `\nReward: ${achievement.reward}` : ""}`;
	}
	private render(): void {
		if (!this.mounted || !this.summary) return;
		this.renderRevision++;
		this.cancelRender?.();
		this.cancelRender = undefined;
		this.grid = [];
		for (const cell of this.cells) {
			cell.border.hide();
			cell.icon.hide();
		}
		for (const header of this.headers) header.hide();
		this.viewport.hide();
		this.list.unmount();
		this.back.hide();
		this.filter.hide();
		const page = this.pages.find((p) => p.id === this.page);
		this.frame.setLabel(
			"selected",
			page?.name ?? "Summary",
			"TOPLEFT",
			16,
			-28,
			22,
			this.width,
		);
		this.frame.setLabel(
			"overall",
			`${formatAchievementNumber(this.summary.points)} points`,
			"TOPRIGHT",
			-16,
			-56,
			13,
		);
		this.frame.setLabel(
			"overall-count",
			formatAchievementProgress(
				this.summary.totals.completed,
				this.summary.totals.total,
				"achievements",
			),
			"TOPLEFT",
			16,
			-56,
			13,
			this.width - 150,
		);
		this.frame.setLabel(
			"actions",
			this.page ? "A: Details   B: Back" : "A: Open category   B: Close",
			"BOTTOMLEFT",
			16,
			12,
			12,
		);
		this.frame.setLabel(
			"loading",
			this.loading ? "Loading achievements..." : "",
			"BOTTOMRIGHT",
			-16,
			12,
			12,
		);
		if (this.loading) {
			this.list.mount(this.body);
			this.list.setRows([
				{
					id: "loading",
					label: "Loading completion categories...",
					heading: true,
					activate: () => {},
				},
			]);
		} else if (!page) {
			this.page = undefined;
			this.list.mount(this.body);
			this.list.setRows([
				{
					id: "summary-progress",
					label: "Overall progress",
					detail: formatAchievementProgress(
						this.summary.totals.completed,
						this.summary.totals.total,
					),
					heading: true,
					height: 64,
					progress: {
						value:
							this.summary.totals.total > 0
								? this.summary.totals.completed / this.summary.totals.total
								: 0,
						color: gold,
					},
					activate: () => {},
				},
				...this.pages.map((p) => ({
					id: `summary-category-${p.id}`,
					label: p.name,
					trailingLabel: formatAchievementProgress(p.completed, p.total),
					trailingOnFirstLine: true,
					height: 67,
					progress: {
						value: p.total > 0 ? p.completed / p.total : 0,
						color: gold,
					},
					activate: () => this.openPage(p.id),
				})),
				...(this.pages.length > 0
					? []
					: [
							{
								id: "empty",
								label: "No achievements to display",
								heading: true,
								activate: () => {},
							},
						]),
			]);
		} else {
			this.back.show();
			this.frame.setLabel(
				"overall-count",
				formatAchievementProgress(page.completed, page.total, "achievements"),
				"TOPLEFT",
				16,
				-56,
				13,
				this.width - 150,
			);
			if (this.expanded !== undefined) {
				this.list.mount(this.body);
				this.list.resetScroll();
				this.list.setRows(this.details());
			} else {
				this.filter.setLabel(
					"label",
					this.incomplete ? "Incomplete only" : "All achievements",
					"CENTER",
					0,
					0,
					12,
				);
				this.filter.show();
				this.viewport.show();
				const visible = this.incomplete
					? buildAchievementPages(this.categories, this.entries, true).find(
							(p) => p.id === page.id,
						)
					: page;
				this.renderGrid(visible ?? page);
			}
		}
		this.navigationChanged?.();
	}
	private renderGrid(page: AchievementPage): void {
		const columns = Math.max(1, Math.floor(this.width / spacing));
		const jobs: (() => void)[] = [];
		const grid: NavGrid = [];
		const generation = this.generation;
		const revision = this.renderRevision;
		let cellIndex = 0;
		let headerIndex = 0;
		let y = 0;
		const heading = (
			title: string,
			count: string,
			size: number,
			height: number,
		) => {
			const index = headerIndex++;
			const top = y;
			jobs.push(() => {
				let header = this.headers.at(index);
				if (!header) {
					header = new Frame(`achievements-header-${index}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(this.width, height, "TOPLEFT", this.content, 0, -top);
				header.setLabel(
					"title",
					title,
					"TOPLEFT",
					0,
					-2,
					size,
					this.width - 190,
				);
				header.setLabel("count", count, "TOPRIGHT", 0, -4, 12, 180);
				header.show();
			});
			y += height;
		};
		for (const section of page.sections) {
			if (!section.groups.length) continue;
			heading(
				section.name,
				formatAchievementProgress(section.completed, section.total),
				18,
				32,
			);
			for (const group of section.groups) {
				heading(
					group.name,
					formatAchievementProgress(group.completed, group.total),
					13,
					24,
				);
				const top = y;
				const firstRow = grid.length;
				for (
					let row = 0;
					row < Math.ceil(group.achievements.length / columns);
					row++
				)
					grid.push([]);
				group.achievements.forEach((achievement, index) => {
					const cellNumber = cellIndex++;
					const row = Math.floor(index / columns);
					const cellTop = top + row * spacing;
					jobs.push(() => {
						let cell = this.cells.at(cellNumber);
						if (!cell) {
							cell = {
								border: new Frame(
									`achievements-border-${cellNumber}`,
									this.pool,
								),
								icon: new Frame(
									`achievements-icon-${cellNumber}`,
									this.pool,
									"Button",
								),
							};
							this.cells.push(cell);
						}
						cell.border.setParent(this.content);
						cell.border.layout(
							42,
							42,
							"TOPLEFT",
							this.content,
							(index % columns) * spacing,
							-cellTop,
						);
						const [red, green, blue] = achievement.completed
							? gold
							: ([0.12, 0.12, 0.12] as const);
						cell.border.setColor(red, green, blue);
						cell.icon.setParent(cell.border);
						cell.icon.layout(38, 38, "CENTER", cell.border);
						cell.icon.setIcon(achievement.icon);
						cell.icon.setOpacity(achievement.completed ? 1 : 0.25);
						const current = () =>
							this.mounted &&
							revision === this.renderRevision &&
							this.expanded === undefined &&
							this.page === page.id;
						const activate = () => {
							if (current()) {
								this.expanded = achievement.id;
								this.render();
							}
						};
						cell.icon.onClick(activate);
						const tooltip = () =>
							current()
								? { text: this.tooltip(achievement), anchor: this.frame }
								: undefined;
						cell.icon.setHoverTooltip(tooltip);
						const node = cell.icon.navigationNode(
							`achievement-${achievement.id}`,
							activate,
							() =>
								this.viewport.revealVerticalRange(
									cellTop,
									cellTop + 42,
									this.contentHeight,
								),
						);
						grid.at(firstRow + row)?.push({
							...node,
							navColumn: index % columns,
							tooltipItem: tooltip,
						});
						cell.border.show();
						cell.icon.show();
					});
				});
				y += Math.ceil(group.achievements.length / columns) * spacing + 12;
			}
			y += 12;
		}
		this.contentHeight = Math.max(1, y);
		this.content.layout(
			this.width,
			this.contentHeight,
			"TOPLEFT",
			this.viewport,
		);
		this.content.setLabel(
			"empty",
			cellIndex > 0 ? "" : "No achievements to display",
			"TOPLEFT",
			0,
			-12,
			14,
			this.width,
		);
		this.viewport.clampScroll();
		let cursor = 0;
		const step = () => {
			if (
				!this.mounted ||
				generation !== this.generation ||
				revision !== this.renderRevision
			)
				return;
			this.cancelRender = undefined;
			const end = Math.min(jobs.length, cursor + 12);
			while (cursor < end) jobs.at(cursor++)?.();
			this.grid = grid.filter((row) => row.length > 0);
			this.navigationChanged?.();
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
		};
		this.cancelRender = this.scheduler.nextFrame(step);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Achievements requires a frame parent");
		this.mounted = true;
		this.width = Math.max(spacing, parent.getSize().width - 32);
		this.frame.fill(parent);
		this.frame.onSizeChanged(() => {
			if (!this.mounted) return;
			const width = Math.max(spacing, this.frame.getSize().width - 32);
			if (width === this.width) return;
			this.width = width;
			this.list.setWidth(width);
			this.render();
		});
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
		this.body.inset(this.frame, 16, 120, 16, 36);
		this.body.show();
		this.list.setWidth(this.width);
		this.viewport.inset(this.frame, 16, 120, 16, 36);
		this.content.setParent(this.viewport);
		this.viewport.setScrollContent(this.content);
		this.content.show();
		this.back.setParent(this.frame);
		this.back.layout(96, 26, "TOPLEFT", this.frame, 16, -82);
		this.back.setButtonBackground();
		this.back.setLabel("label", "‹ Back", "CENTER", 0, 0, 13);
		this.back.onClick(() => this.onBack());
		this.filter.setParent(this.frame);
		this.filter.layout(
			Math.min(180, this.width - 110),
			26,
			"TOPRIGHT",
			this.frame,
			-16,
			-82,
		);
		this.filter.setButtonBackground();
		this.filter.onClick(() => this.toggleFilter());
		this.frame.show();
		this.render();
		this.update.setActive(true);
	}
	private toggleFilter(): void {
		this.incomplete = !this.incomplete;
		this.viewport.resetScroll();
		this.render();
	}
	onUnmount(): void {
		this.mounted = false;
		this.update.setActive(false);
		this.cancelScan?.();
		this.cancelRender?.();
		this.cancelScan = undefined;
		this.cancelRender = undefined;
		this.generation++;
		if (this.scanning) this.update.invalidate();
		this.list.unmount();
		this.frame.hide();
	}
	onContainerClosed(): void {
		this.page = undefined;
		this.expanded = undefined;
		this.pendingCategory = undefined;
		this.incomplete = false;
		this.close();
	}
	getNavGrid(): NavGrid {
		if (!this.mounted) return [];
		if (this.loading || !this.page) return this.list.getNavGrid();
		const back = {
			...this.back.navigationNode("achievements-back", () => this.onBack()),
			navColumn: 0,
		};
		if (this.expanded !== undefined) return [[back], ...this.list.getNavGrid()];
		const filter = {
			...this.filter.navigationNode("achievements-filter", () =>
				this.toggleFilter(),
			),
			navColumn: Math.max(1, Math.floor(this.width / spacing) - 1),
		};
		return [[back, filter], ...this.grid];
	}
	setNavigationChanged(callback?: () => void): void {
		this.navigationChanged = callback;
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
		for (const cell of this.cells) {
			cell.icon.destroy();
			cell.border.destroy();
		}
		for (const header of this.headers) header.destroy();
		this.filter.destroy();
		this.back.destroy();
		this.content.destroy();
		this.viewport.destroy();
		this.body.destroy();
		this.frame.destroy();
	}
}
