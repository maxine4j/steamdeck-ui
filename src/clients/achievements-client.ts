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
export interface IAchievementsClient {
	categories(): AchievementCategory[];
	totals(category: number): AchievementTotals;
	achievements(category: number, incomplete: boolean): Achievement[];
	summary(): AchievementSummary;
	criteria(id: number): AchievementCriterion[];
	chain(id: number): Achievement[];
	categoryFor(id: number): number;
	achievement(id: number): Achievement;
	selection(id: number): number;
}
export class AchievementsClient implements IAchievementsClient {
	categories(): AchievementCategory[] {
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
		return {
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
	}
	achievement(id: number): Achievement {
		return this.read(id);
	}
	categoryFor(id: number): number {
		return GetAchievementCategory(id);
	}
	selection(id: number): number {
		let current = id;
		if (!this.read(id).completed) {
			let previous = GetPreviousAchievement(current);
			while (previous !== undefined && !this.read(previous).completed) {
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
	summary(): AchievementSummary {
		const categories = this.categories();
		const [total, completed] = GetNumCompletedAchievements();
		const recent = [...GetLatestCompletedAchievements()]
			.slice(0, 3)
			.map((id) => this.read(id));
		for (const id of [6, 503, 116]) {
			if (recent.length >= 3) break;
			const row = this.read(id);
			if (!row.completed && !recent.some((a) => a.id === id)) recent.push(row);
		}
		return {
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
	}
	criteria(id: number): AchievementCriterion[] {
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
		return criteria;
	}
	chain(id: number): Achievement[] {
		const rows = [this.read(id)];
		let previous = GetPreviousAchievement(id);
		while (previous !== undefined) {
			rows.unshift(this.read(previous));
			previous = GetPreviousAchievement(previous);
		}
		return rows.length > 1 && rows.at(-1)?.completed ? rows : [];
	}
}
