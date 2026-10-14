import type { IEventBus } from "../events/types";
import type { ICollectionCache } from "./collection-cache";
import type { SavedVariableCache } from "./saved-variable-cache";
import type { ITaskScheduler } from "./task-scheduler";
export interface AchievementTotals {
	total: number;
	completed: number;
}
export interface AchievementCategory {
	id: number;
	name: string;
	parent: number;
}
export interface Achievement {
	id: number;
	name: string;
	points: number;
	completed: boolean;
	date: string;
	description: string;
	icon: number;
	reward: string;
}
export interface AchievementCriterion {
	name: string;
	completed: boolean;
	quantity: number;
	required: number;
	text: string;
	progress: boolean;
	achievement?: number;
}
export interface AchievementSummary {
	points: number;
	totals: AchievementTotals;
	recent: Achievement[];
	categories: (AchievementCategory & AchievementTotals)[];
}
export interface CachedAchievementCatalog {
	categories: AchievementCategory[];
	entries: Map<number, readonly Achievement[]>;
}
export interface IAchievementsClient {
	cachedCatalog?(): CachedAchievementCatalog | undefined;
	prefetch?(): void;
	stop?(): void;
	invalidate?(id?: number): void;
	loadCategory(
		category: number,
		complete: (achievements: Achievement[]) => void,
		progress?: (
			completed: number,
			total: number,
			rows: readonly Achievement[],
		) => void,
		refresh?: boolean,
	): () => void;
	categories(): AchievementCategory[];
	totals(category: number): AchievementTotals;
	achievements(category: number, incomplete: boolean): Achievement[];
	summary(includeCategories?: boolean): AchievementSummary;
	criteria(id: number): AchievementCriterion[];
	chain(id: number): Achievement[];
	categoryFor(id: number): number;
	achievement(id: number): Achievement;
	selection(id: number): number;
}
export class AchievementsClient implements IAchievementsClient {
	private readonly items?: SavedVariableCache<Achievement>;
	private readonly categoryRows?: SavedVariableCache<Achievement[]>;
	private readonly categoryList?: SavedVariableCache<AchievementCategory[]>;
	private readonly summaries?: SavedVariableCache<AchievementSummary>;
	private readonly criterionRows?: SavedVariableCache<AchievementCriterion[]>;
	private cancelBackfill?: () => void;
	private cancelNotification?: () => void;
	private generation = 0;
	constructor(
		private readonly scheduler: ITaskScheduler,
		cache?: ICollectionCache,
		private readonly events?: IEventBus,
	) {
		this.items = cache?.create("achievements.items", true);
		this.categoryRows = cache?.create("achievements.categories", true);
		this.categoryList = cache?.create("achievements.category-list", false);
		this.summaries = cache?.create("achievements.summary", true);
		this.criterionRows = cache?.create("achievements.criteria", true);
	}
	prefetch(): void {
		if (!this.items || this.cancelBackfill) return;
		const generation = this.generation;
		let categories: AchievementCategory[] | undefined;
		let index = 0;
		const step = () => {
			if (generation !== this.generation) return;
			categories ??= this.readCategories();
			this.categoryList?.put("list", categories);
			const category = categories.at(index++);
			if (!category) {
				this.cancelBackfill = undefined;
				return;
			}
			this.cancelBackfill = this.scanCategory(category.id, () => {
				this.cancelBackfill = this.scheduler.nextFrame(step);
			});
		};
		this.cancelBackfill = this.scheduler.nextFrame(step);
	}
	stop(): void {
		this.generation++;
		this.cancelBackfill?.();
		this.cancelNotification?.();
		this.cancelBackfill = undefined;
		this.cancelNotification = undefined;
		for (const cache of [
			this.items,
			this.categoryRows,
			this.categoryList,
			this.summaries,
			this.criterionRows,
		])
			cache?.stop();
	}
	invalidate(id?: number): void {
		if (id !== undefined) {
			this.items?.refresh(String(id), () => this.read(id));
			if (this.criterionRows?.peek(String(id)))
				this.criterionRows.refresh(String(id), () => this.readCriteria(id));
		}
	}
	private changed(): void {
		if (!this.events || this.cancelNotification) return;
		const generation = this.generation;
		this.cancelNotification = this.scheduler.nextFrame(() => {
			if (generation !== this.generation) return;
			this.cancelNotification = undefined;
			this.events?.emit("ACHIEVEMENTS_CACHE_UPDATED");
		});
	}
	cachedCatalog(): CachedAchievementCatalog | undefined {
		const categories = this.categoryList?.peek("list");
		if (!categories) return undefined;
		const entries = new Map<number, readonly Achievement[]>();
		for (const category of categories) {
			const rows = this.categoryRows?.peek(String(category.id));
			if (rows === undefined) return undefined;
			entries.set(
				category.id,
				rows.map((row) => this.items?.peek(String(row.id)) ?? row),
			);
		}
		return { categories: categories.slice(), entries };
	}
	loadCategory(
		category: number,
		complete: (achievements: Achievement[]) => void,
		progress?: (
			completed: number,
			total: number,
			rows: readonly Achievement[],
		) => void,
		refresh = true,
	): () => void {
		const rows = this.categoryRows?.peek(String(category));
		if (rows && this.items) {
			complete(
				rows.map((row) => {
					if (this.items?.peek(String(row.id)) === undefined)
						this.items?.put(String(row.id), row);
					return refresh
						? this.achievement(row.id)
						: (this.items?.peek(String(row.id)) ?? row);
				}),
			);
			return () => {};
		}
		return this.scanCategory(category, complete, progress);
	}
	private scanCategory(
		category: number,
		complete: (achievements: Achievement[]) => void,
		progress?: (
			completed: number,
			total: number,
			rows: readonly Achievement[],
		) => void,
	): () => void {
		let cancelled = false;
		let cancelNext: (() => void) | undefined;
		let phase:
			| "count"
			| "row"
			| "previous"
			| "previous-read"
			| "next"
			| "next-read" = "count";
		let count = 0;
		let index = 1;
		let cursor = 0;
		let representative = 0;
		let chain: Achievement[] = [];
		const rows: Achievement[] = [];
		let published = 0;
		const seen = new Set<number>();
		let visited = new Set<number>();
		const step = () => {
			if (cancelled) return;
			cancelNext = undefined;
			for (let operation = 0; operation < 60; operation++) {
				if (phase === "count") {
					[count] = GetCategoryNumAchievements(category);
					phase = "row";
				} else if (phase === "row") {
					if (index > count) {
						this.categoryRows?.put(String(category), rows);
						complete(rows);
						return;
					}
					const achievement = this.read(category, index);
					if (seen.has(achievement.id)) {
						index++;
						continue;
					}
					representative = achievement.id;
					cursor = representative;
					chain = [achievement];
					visited = new Set([representative]);
					phase = "previous";
				} else if (phase === "previous") {
					const id = GetPreviousAchievement(cursor);
					if (id !== undefined && !visited.has(id)) {
						cursor = id;
						visited.add(id);
						phase = "previous-read";
					} else {
						cursor = representative;
						phase = "next";
					}
				} else if (phase === "previous-read") {
					chain.unshift(this.read(cursor));
					phase = "previous";
				} else if (phase === "next") {
					const [id] = GetNextAchievement(cursor);
					if (id !== undefined && !visited.has(id)) {
						cursor = id;
						visited.add(id);
						phase = "next-read";
					} else {
						for (const achievement of chain)
							if (!seen.has(achievement.id)) {
								seen.add(achievement.id);
								rows.push(achievement);
							}
						index++;
						phase = "row";
					}
				} else {
					chain.push(this.read(cursor));
					phase = "next";
				}
			}
			progress?.(Math.min(index - 1, count), count, rows.slice(published));
			published = rows.length;
			cancelNext = this.scheduler.nextFrame(step);
		};
		cancelNext = this.scheduler.nextFrame(step);
		return () => {
			cancelled = true;
			cancelNext?.();
		};
	}
	categories(): AchievementCategory[] {
		return (
			this.categoryList?.get("list", () => this.readCategories()) ??
			this.readCategories()
		);
	}
	private readCategories(): AchievementCategory[] {
		const source = GetCategoryList().map((id) => this.category(id));
		const ordered: AchievementCategory[] = [];
		const visited = new Set<number>();
		const visit = (category: AchievementCategory) => {
			if (visited.has(category.id)) return;
			visited.add(category.id);
			ordered.push(category);
			for (const child of source.filter((c) => c.parent === category.id))
				visit(child);
		};
		for (const root of source.filter((c) => c.parent === -1)) visit(root);
		// Retain orphaned categories if Blizzard changes the hierarchy.
		for (const category of source) visit(category);
		return ordered;
	}
	private category(id: number): AchievementCategory {
		const [name, parent] = GetCategoryInfo(id);
		return { id, name, parent };
	}
	totals(category: number): AchievementTotals {
		return this.categoryTotals(category, this.categories());
	}
	private categoryTotals(
		category: number,
		categories: AchievementCategory[],
	): AchievementTotals {
		let total = 0;
		let completed = 0;
		const visited = new Set<number>();
		const visit = (id: number) => {
			if (visited.has(id)) return;
			visited.add(id);
			const [count, done] = GetCategoryNumAchievements(id, true);
			total += count;
			completed += done;
			for (const child of categories.filter((c) => c.parent === id))
				visit(child.id);
		};
		visit(category);
		return { total, completed };
	}
	achievements(category: number, incomplete: boolean): Achievement[] {
		const saved = this.categoryRows?.peek(String(category));
		if (saved)
			return saved
				.map((row) => this.achievement(row.id))
				.filter((row) => !incomplete || !row.completed);
		const [count, , incompleteCount] = GetCategoryNumAchievements(category);
		const rows: Achievement[] = [];
		const offset = incomplete ? count - incompleteCount : 0;
		const seen = new Set<number>();
		const append = (achievement: Achievement) => {
			if (!seen.has(achievement.id)) {
				seen.add(achievement.id);
				rows.push(achievement);
			}
		};
		for (let index = offset + 1; index <= count; index++) {
			const achievement = this.read(category, index);
			if (!incomplete) {
				const previous: Achievement[] = [];
				const visited = new Set<number>([achievement.id]);
				let id = GetPreviousAchievement(achievement.id);
				while (id !== undefined && !visited.has(id)) {
					visited.add(id);
					previous.unshift(this.read(id));
					id = GetPreviousAchievement(id);
				}
				for (const step of previous) append(step);
			}
			append(achievement);
			if (!incomplete) {
				let [id] = GetNextAchievement(achievement.id);
				while (id !== undefined && !seen.has(id)) {
					append(this.read(id));
					[id] = GetNextAchievement(id);
				}
			}
		}
		return rows;
	}
	private read(id: number, index?: number): Achievement {
		const [
			achievementID,
			name,
			points,
			completed,
			month,
			day,
			year,
			description,
			,
			icon,
			reward,
		] = GetAchievementInfo(id, index);
		const row = {
			id: achievementID,
			name,
			points,
			completed,
			date:
				completed && month && day && year !== undefined
					? `${day}/${month}/${year + 2000}`
					: "",
			description,
			icon,
			reward,
		};
		const old = this.items?.peek(String(row.id));
		this.items?.put(String(row.id), row);
		if (
			old &&
			(old.completed !== row.completed ||
				old.name !== row.name ||
				old.date !== row.date ||
				old.points !== row.points ||
				old.description !== row.description ||
				old.reward !== row.reward ||
				old.icon !== row.icon)
		)
			this.changed();
		return row;
	}
	achievement(id: number): Achievement {
		return this.items?.get(String(id), () => this.read(id)) ?? this.read(id);
	}
	categoryFor(id: number): number {
		return GetAchievementCategory(id);
	}
	selection(id: number): number {
		let current = id;
		if (!this.achievement(id).completed) {
			let previous = GetPreviousAchievement(current);
			while (previous !== undefined && !this.achievement(previous).completed) {
				current = previous;
				previous = GetPreviousAchievement(current);
			}
			return current;
		}
		let [next, completed] = GetNextAchievement(current);
		while (next !== undefined && completed) {
			current = next;
			[next, completed] = GetNextAchievement(current);
		}
		return current;
	}
	summary(includeCategories = true): AchievementSummary {
		return (
			this.summaries?.get(String(includeCategories), () =>
				this.readSummary(includeCategories),
			) ?? this.readSummary(includeCategories)
		);
	}
	private readSummary(includeCategories: boolean): AchievementSummary {
		const categories = includeCategories ? this.categories() : [];
		const [total, completed] = GetNumCompletedAchievements();
		const recent = [...GetLatestCompletedAchievements()]
			.slice(0, 3)
			.map((id) => this.read(id));
		for (const id of [6, 503, 116]) {
			if (recent.length >= 3) break;
			const row = this.read(id);
			if (!row.completed && !recent.some((a) => a.id === id)) recent.push(row);
		}
		const summary = {
			points: GetTotalAchievementPoints(),
			totals: { total, completed },
			recent,
			categories: categories
				.filter((c) => c.parent === -1)
				.map((category) => ({
					...category,
					...this.categoryTotals(category.id, categories),
				})),
		};
		const old = this.summaries?.peek(String(includeCategories));
		if (
			old &&
			(old.points !== summary.points ||
				old.totals.total !== total ||
				old.totals.completed !== completed ||
				old.recent.map((row) => row.id).join(",") !==
					recent.map((row) => row.id).join(","))
		)
			this.changed();
		return summary;
	}
	criteria(id: number): AchievementCriterion[] {
		return (
			this.criterionRows?.get(String(id), () => this.readCriteria(id)) ??
			this.readCriteria(id)
		);
	}
	private readCriteria(id: number): AchievementCriterion[] {
		const criteria: AchievementCriterion[] = [];
		for (let index = 1; index <= GetAchievementNumCriteria(id); index++) {
			const [name, type, completed, quantity, required, , flags, asset, text] =
				GetAchievementCriteriaInfo(id, index);
			criteria.push({
				name,
				completed,
				quantity,
				required,
				text,
				progress:
					flags !== 0 &&
					Math.floor(flags / EVALUATION_TREE_FLAG_PROGRESS_BAR) % 2 === 1,
				achievement: type === 8 && asset > 0 ? asset : undefined,
			});
		}
		const old = this.criterionRows?.peek(String(id));
		if (
			old &&
			(old.length !== criteria.length ||
				criteria.some((row, index) => {
					const previous = old.at(index);
					return (
						!previous ||
						row.quantity !== previous.quantity ||
						row.completed !== previous.completed ||
						row.required !== previous.required ||
						row.text !== previous.text ||
						row.name !== previous.name
					);
				}))
		)
			this.changed();
		return criteria;
	}
	chain(id: number): Achievement[] {
		const rows = [this.achievement(id)];
		let previous = GetPreviousAchievement(id);
		while (previous !== undefined) {
			rows.unshift(this.achievement(previous));
			previous = GetPreviousAchievement(previous);
		}
		return rows.length > 1 && rows.at(-1)?.completed ? rows : [];
	}
}
