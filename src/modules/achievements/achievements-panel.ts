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
	achievementCategoryIcon,
	achievementCategoryTint,
	achievementPageFor,
	achievementPageName,
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
	navId?: string;
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
	private readonly loadingTrack: Frame;
	private readonly loadingProgress: Frame;
	private readonly update: DeferredRefresh;
	private readonly cells: AchievementCell[] = [];
	private readonly headers: Frame[] = [];
	private mounted = false;
	private categories: AchievementCategory[] = [];
	private entries = new Map<number, readonly Achievement[]>();
	private pages: AchievementPage[] = [];
	private summary?: AchievementSummary;
	private catalogLoaded = false;
	private page?: string;
	private pendingCategory?: number;
	private selectedAchievement?: number;
	private pendingFocus?: string;
	private incomplete = false;
	private loading = false;
	private scanning = false;
	private width = 468;
	private contentHeight = 1;
	private grid: NavGrid = [];
	private renderedPage?: string;
	private generation = 0;
	private renderRevision = 0;
	private renderDirty = true;
	private cancelScan?: () => void;
	private cancelRender?: () => void;
	private navigationChanged?: (focusId?: string) => void;
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
		this.loadingTrack = new Frame("achievements-loading-track", pool);
		this.loadingProgress = new Frame("achievements-loading-progress", pool);
		this.list = new ScrollList("achievements-list", pool, "", close, {
			autoHeight: true,
			background: false,
			padding: 0,
			top: 0,
			bottom: 0,
			gap: 12,
			batchSize: 30,
			contentPadding: { horizontal: 18, vertical: 16 },
			progressInset: { horizontal: 0, bottom: 12 },
			scheduler,
			onChanged: (complete) => {
				if (complete) this.renderDirty = false;
				this.navigationChanged?.();
			},
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
		const summary = this.client.summary(false);
		const entries = new Map<number, readonly Achievement[]>();
		const totals = new Map<string, { total: number; completed: number }>();
		const seen = new Set<number>();
		const firstLoad = !this.catalogLoaded;
		this.loading = false;
		this.scanning = true;
		this.setLoadingProgress(0);
		if (firstLoad) {
			this.summary = summary;
			this.categories = categories;
			const pageNames = new Set<string>();
			this.pages = categories
				.filter((c) => c.parent === -1)
				.filter((category) => {
					const name = achievementPageName(category);
					if (pageNames.has(name)) return false;
					pageNames.add(name);
					return true;
				})
				.map((category) => {
					const name = achievementPageName(category);
					return {
						total: 0,
						completed: 0,
						pending: true,
						id: name,
						name,
						sections: [],
					};
				});
			this.render();
		}
		const publish = (
			category: AchievementCategory,
			achievements: readonly Achievement[],
		) => {
			const root = achievementRoot(categories, category.id) ?? category;
			for (const achievement of achievements) {
				if (seen.has(achievement.id)) continue;
				seen.add(achievement.id);
				const name = achievementPageFor(achievement.id, root);
				const value = totals.get(name) ?? { total: 0, completed: 0 };
				value.total++;
				if (achievement.completed) value.completed++;
				totals.set(name, value);
			}
			if (firstLoad) {
				this.pages = this.pages.map((page) => {
					const value = totals.get(page.id);
					return value ? { ...page, ...value, pending: false } : page;
				});
				if (this.page === undefined) this.list.updateRows(this.summaryRows());
			}
		};
		const generation = this.generation;
		let cursor = 0;
		const step = () => {
			if (!this.mounted || generation !== this.generation) return;
			this.cancelScan = undefined;
			if (this.page !== undefined) {
				const offset = categories
					.slice(cursor)
					.findIndex(
						(category) =>
							achievementPageName(
								achievementRoot(categories, category.id) ?? category,
							) === this.page,
					);
				if (offset > 0) {
					const preferred = categories.splice(cursor + offset, 1).at(0);
					if (preferred) categories.splice(cursor, 0, preferred);
				}
			}
			const category = categories.at(cursor);
			if (category) {
				let completed = false;
				const cancel = this.client.loadCategory(
					category.id,
					(achievements) => {
						if (!this.mounted || generation !== this.generation) return;
						completed = true;
						entries.set(category.id, achievements);
						cursor++;
						const previous = this.pages.find((page) => page.id === this.page);
						publish(category, achievements);
						if (firstLoad) this.entries = entries;
						if (firstLoad && this.page !== undefined) {
							const selected = buildAchievementPages(categories, entries).find(
								(page) => page.id === this.page,
							);
							if (
								selected &&
								(previous?.sections.length === 0 ||
									selected.total !== previous?.total ||
									selected.completed !== previous?.completed)
							) {
								this.pages = this.pages.map((page) =>
									page.id === selected.id ? selected : page,
								);
								this.render();
							}
						}
						this.setLoadingProgress(
							(0.5 * cursor) / Math.max(1, categories.length),
						);
						this.cancelScan = this.scheduler.nextFrame(step);
					},
					(completed, total, rows) => {
						if (!this.mounted || generation !== this.generation) return;
						entries.set(category.id, [
							...(entries.get(category.id) ?? []),
							...rows,
						]);
						if (firstLoad) this.entries = entries;
						publish(category, rows);
						this.setLoadingProgress(
							(0.5 * (cursor + (total > 0 ? completed / total : 1))) /
								Math.max(1, categories.length),
						);
					},
					false,
				);
				// Cached loads complete inline; retain the scheduled continuation's cancel.
				if (!completed) this.cancelScan = cancel;
			} else {
				this.loading = false;
				this.scanning = false;
				this.catalogLoaded = true;
				this.categories = categories;
				this.entries = entries;
				this.summary = summary;
				this.pages = buildAchievementPages(this.categories, this.entries);
				this.resolveSelection();
				this.render();
				this.refreshPageRecords();
				if (this.page === undefined) this.finishLoading();
			}
		};
		this.cancelScan = this.scheduler.nextFrame(step);
	}
	private setLoadingProgress(progress: number): void {
		this.frame.setLabel(
			"loading",
			"Loading achievements...",
			"BOTTOMRIGHT",
			-16,
			16,
			12,
		);
		this.loadingTrack.setParent(this.frame);
		this.loadingTrack.layout(140, 4, "BOTTOMRIGHT", this.frame, -16, 8);
		this.loadingTrack.setColor(0.12, 0.12, 0.12);
		this.loadingProgress.setParent(this.loadingTrack);
		this.loadingProgress.setColor(1, 0.82, 0);
		this.loadingTrack.show();
		if (progress <= 0) this.loadingProgress.hide();
		else {
			this.loadingProgress.layout(
				140 * Math.min(1, progress),
				4,
				"TOPLEFT",
				this.loadingTrack,
			);
			this.loadingProgress.show();
		}
	}
	private finishLoading(): void {
		this.loadingTrack.hide();
		this.frame.setLabel("loading", "", "BOTTOMRIGHT", -16, 16, 12);
	}
	selectCategory(id?: number): void {
		this.pendingFocus = undefined;
		this.pendingCategory = id;
		this.selectedAchievement = undefined;
		this.page = undefined;
		this.incomplete = false;
		this.resolveSelection();
		this.viewport.resetScroll();
		this.list.resetScroll();
		this.render();
		this.refreshPageRecords();
	}
	private refreshPageRecords(): void {
		const page = this.pages.find((page) => page.id === this.page);
		if (!page) return;
		const seen = new Set<number>();
		for (const section of page.sections)
			for (const group of section.groups)
				for (const row of group.achievements) {
					if (seen.has(row.id)) continue;
					seen.add(row.id);
					this.client.achievement(row.id);
				}
	}
	private resolveSelection(): void {
		if (this.loading) return;
		if (this.selectedAchievement !== undefined) {
			this.page = this.pages.find((p) =>
				p.sections.some((s) =>
					s.groups.some((g) =>
						g.achievements.some((a) => a.id === this.selectedAchievement),
					),
				),
			)?.id;
			if (!this.page) {
				// Deep links may target an achievement hidden from normal enumeration.
				const achievement = this.client.achievement(this.selectedAchievement);
				const category = this.client.categoryFor(this.selectedAchievement);
				this.entries.set(category, [
					...(this.entries.get(category) ?? []),
					achievement,
				]);
				this.pages = buildAchievementPages(this.categories, this.entries);
				this.page = this.pages.find((p) =>
					p.sections.some((s) =>
						s.groups.some((g) =>
							g.achievements.some((a) => a.id === this.selectedAchievement),
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
		this.selectedAchievement = this.client.selection(id);
		this.pendingFocus = `achievement-${this.selectedAchievement}`;
		this.incomplete = false;
		if (this.summary) {
			this.resolveSelection();
			this.render();
		} else this.refresh();
	}
	private openPage(page: string): void {
		this.pendingFocus = undefined;
		this.page = page;
		this.selectedAchievement = undefined;
		this.incomplete = false;
		if (this.scanning && !this.catalogLoaded) {
			const loaded = buildAchievementPages(this.categories, this.entries).find(
				(candidate) => candidate.id === page,
			);
			if (loaded)
				this.pages = this.pages.map((candidate) =>
					candidate.id === page ? loaded : candidate,
				);
		}
		this.viewport.resetScroll();
		this.list.resetScroll();
		this.render();
		this.refreshPageRecords();
	}
	onBack(): void {
		if (this.page !== undefined) this.selectCategory();
		else this.close();
	}
	private tooltip(achievement: Achievement): string {
		return `${achievement.name}\n${formatAchievementNumber(achievement.points)} points • ${achievement.completed ? `Completed ${achievement.date}` : "Incomplete"}\n${achievement.description}${achievement.reward !== "" ? `\nReward: ${achievement.reward}` : ""}`;
	}
	private summaryRows(): ListRow[] {
		if (!this.summary) return [];
		return [
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
				icon: achievementCategoryIcon(p.id),
				iconSize: 20,
				backgroundAtlas: "ui-journeys-renown-button",
				backgroundTint: achievementCategoryTint(p.id),
				fontSize: 12,
				wrapLabel: true,
				trailingLabel: p.pending
					? "Loading..."
					: formatAchievementProgress(p.completed, p.total)
							.replace(" / ", "/")
							.replace(" • ", " "),
				trailingOnSecondLine: true,
				height: 80,
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
		];
	}
	private render(): void {
		if (!this.mounted || !this.summary) return;
		this.renderDirty = true;
		this.renderRevision++;
		this.cancelRender?.();
		this.cancelRender = undefined;
		if (this.renderedPage !== this.page || this.page === undefined) {
			this.grid = [];
			this.viewport.hide();
		}
		this.renderedPage = this.page;
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
			this.scanning ? "Loading achievements..." : "",
			"BOTTOMRIGHT",
			-16,
			16,
			12,
		);
		if (this.loading) {
			this.list.mount(this.body);
			this.list.setRows([]);
		} else if (!page) {
			this.page = undefined;
			this.list.setColumns(2);
			this.list.mount(this.body);
			this.list.setRows(this.summaryRows());
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
			this.filter.setLabel(
				"label",
				this.incomplete ? "Incomplete only" : "All achievements",
				"CENTER",
				0,
				0,
				12,
			);
			this.filter.show();
			const visible = this.incomplete
				? buildAchievementPages(this.categories, this.entries, true).find(
						(p) => p.id === page.id,
					)
				: page;
			this.renderGrid(visible ?? page);
		}
		this.navigationChanged?.();
	}
	private renderGrid(page: AchievementPage): void {
		if (!this.scanning) this.setLoadingProgress(0.5);
		const groupWidth = (this.width - 16) / 2;
		const columns = Math.max(
			1,
			Math.min(5, Math.floor((groupWidth + 4) / spacing)),
		);
		const jobs: (() => void)[] = [];
		const grid: NavGrid = [];
		const retained = new Map(
			this.grid.flat().map((node) => [node.navId, node]),
		);
		const cellsById = new Map<string, AchievementCell>();
		for (const cell of this.cells)
			if (cell.navId) cellsById.set(cell.navId, cell);
		const wanted = new Set(
			page.sections.flatMap((section) =>
				section.groups.flatMap((group) =>
					group.achievements.map(
						(achievement) => `achievement-${achievement.id}`,
					),
				),
			),
		);
		const available = this.cells.filter(
			(cell) => !cell.navId || !wanted.has(cell.navId),
		);
		for (const cell of available) cell.navId = undefined;
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
			layout?: { left: number; top: number; width: number },
		) => {
			const index = headerIndex++;
			const top = layout?.top ?? y;
			const width = layout?.width ?? this.width;
			jobs.push(() => {
				let header = this.headers.at(index);
				if (!header) {
					header = new Frame(`achievements-header-${index}`, this.pool);
					this.headers.push(header);
				}
				header.setParent(this.content);
				header.layout(
					width,
					height,
					"TOPLEFT",
					this.content,
					layout?.left ?? 0,
					-top,
				);
				header.setLabel(
					"title",
					title,
					"TOPLEFT",
					0,
					-2,
					size,
					layout ? width : width - 190,
				);
				header.setLabel(
					"count",
					count,
					layout ? "TOPLEFT" : "TOPRIGHT",
					0,
					layout ? -36 : -4,
					12,
					layout ? width : 180,
				);
				header.show();
			});
			if (!layout) y += height;
		};
		for (const section of page.sections) {
			if (!section.groups.length) continue;
			heading(
				section.name,
				formatAchievementProgress(section.completed, section.total),
				18,
				32,
			);
			for (
				let groupIndex = 0;
				groupIndex < section.groups.length;
				groupIndex += 2
			) {
				const pair = section.groups.slice(groupIndex, groupIndex + 2);
				const groupTop = y;
				const top = groupTop + 56;
				const firstRow = grid.length;
				const rows = pair.reduce(
					(maximum, group) =>
						Math.max(maximum, Math.ceil(group.achievements.length / columns)),
					0,
				);
				for (let row = 0; row < rows; row++) grid.push([]);
				pair.forEach((group, side) => {
					const left = side * (groupWidth + 16);
					heading(
						group.name,
						formatAchievementProgress(group.completed, group.total),
						13,
						56,
						{ left, top: groupTop, width: groupWidth },
					);
					group.achievements.forEach((achievement, index) => {
						cellIndex++;
						const navId = `achievement-${achievement.id}`;
						let cell = cellsById.get(navId) ?? available.pop();
						const row = Math.floor(index / columns);
						const previous = retained.get(navId);
						if (previous)
							grid.at(firstRow + row)?.push({
								...previous,
								navColumn: side * columns + (index % columns),
							});
						const cellTop = top + row * spacing;
						jobs.push(() => {
							if (!cell) {
								const cellNumber = this.cells.length;
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
							cell.navId = navId;
							cell.border.setParent(this.content);
							cell.border.layout(
								42,
								42,
								"TOPLEFT",
								this.content,
								left + (index % columns) * spacing,
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
								this.mounted && cell?.navId === navId && this.page === page.id;
							const activate = () => {
								if (current()) {
									this.selectedAchievement = achievement.id;
									this.navigationChanged?.(`achievement-${achievement.id}`);
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
							const navRow = grid.at(firstRow + row);
							const oldIndex =
								navRow?.findIndex((candidate) => candidate.navId === navId) ??
								-1;
							if (oldIndex >= 0) navRow?.splice(oldIndex, 1);
							navRow?.push({
								...node,
								navigationScroll: this.viewport,
								navColumn: side * columns + (index % columns),
								tooltipItem: tooltip,
							});
							navRow?.sort((a, b) => (a.navColumn ?? 0) - (b.navColumn ?? 0));
							cell.border.show();
							cell.icon.show();
						});
					});
				});
				y = top + rows * spacing + 12;
			}
			y += 12;
		}
		// Retain visible controls while replacing their data; only surplus controls
		// need cleanup, after the new controls have been published.
		for (const cell of available)
			jobs.push(() => {
				cell.border.hide();
				cell.icon.hide();
				cell.navId = undefined;
			});
		for (const header of this.headers.slice(headerIndex))
			jobs.push(() => header.hide());
		this.contentHeight = Math.max(1, y);
		this.content.layout(
			this.width,
			this.contentHeight,
			"TOPLEFT",
			this.viewport,
		);
		this.content.setLabel(
			"empty",
			cellIndex > 0 || this.scanning ? "" : "No achievements to display",
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
			const end = Math.min(jobs.length, cursor + 36);
			while (cursor < end) jobs.at(cursor++)?.();
			if (!this.scanning)
				this.setLoadingProgress(
					0.5 + 0.5 * (jobs.length > 0 ? cursor / jobs.length : 1),
				);
			this.viewport.show();
			this.grid = grid.filter((row) => row.length > 0);
			const focusId = this.grid
				.flat()
				.some((node) => node.navId === this.pendingFocus)
				? this.pendingFocus
				: undefined;
			if (focusId) this.pendingFocus = undefined;
			this.navigationChanged?.(focusId);
			if (cursor < jobs.length)
				this.cancelRender = this.scheduler.nextFrame(step);
			else {
				this.renderDirty = false;
				if (!this.scanning) this.finishLoading();
			}
		};
		this.cancelRender = this.scheduler.nextFrame(step);
	}
	onMount(parent: IUIComponent): void {
		if (!(parent instanceof Frame))
			throw new Error("Achievements requires a frame parent");
		this.mounted = true;
		const width = Math.max(spacing, parent.getSize().width - 32);
		if (width !== this.width) this.renderDirty = true;
		this.width = width;
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
		if (this.renderDirty) this.render();
		else if (this.page === undefined) this.list.mount(this.body);
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
		this.pendingFocus = undefined;
		this.renderDirty = true;
		this.page = undefined;
		this.selectedAchievement = undefined;
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
		const filter = {
			...this.filter.navigationNode("achievements-filter", () =>
				this.toggleFilter(),
			),
			navColumn: Math.max(1, Math.floor(this.width / spacing) - 1),
		};
		return [[back, filter], ...this.grid];
	}
	setNavigationChanged(callback?: (focusId?: string) => void): void {
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
		this.loadingProgress.destroy();
		this.loadingTrack.destroy();
		this.back.destroy();
		this.content.destroy();
		this.viewport.destroy();
		this.body.destroy();
		this.frame.destroy();
	}
}
