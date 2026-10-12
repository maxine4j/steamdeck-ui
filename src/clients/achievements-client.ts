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
const summaryCategories = [
	92, 96, 97, 15522, 95, 168, 169, 201, 155, 15117, 15246,
];
export class AchievementsClient implements IAchievementsClient {
	categories(): AchievementCategory[] {
		const source = GetCategoryList().map((id) => this.category(id));
		return source
			.filter((c) => c.parent === -1)
			.flatMap((parent) => [
				parent,
				...source.filter((c) => c.parent === parent.id),
			]);
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
		let [total, completed] = GetCategoryNumAchievements(category, true);
		for (const child of categories.filter((c) => c.parent === category)) {
			const [count, done] = GetCategoryNumAchievements(child.id, true);
			total += count;
			completed += done;
		}
		return { total, completed };
	}
	achievements(category: number, incomplete: boolean): Achievement[] {
		const [count, , incompleteCount] = GetCategoryNumAchievements(category);
		const rows: Achievement[] = [];
		const offset = incomplete ? count - incompleteCount : 0;
		for (let index = offset + 1; index <= count; index++) {
			rows.push(this.read(category, index));
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
			categories: summaryCategories.map((id) => ({
				...this.category(id),
				...this.categoryTotals(id, categories),
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
