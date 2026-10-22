export interface PreyTarget {
	readonly difficulty: 1 | 2 | 3;
	readonly needed: boolean;
}

// Numeric facts verified against Plumber af2f562ec474f688fd0ae5ea50e70888dda12df8,
// Modules/Shared/SharedData.lua (PreyQuestData) and Modules/HuntTable.lua.
// These ranges exactly encode that table; see modules/prey/SOURCES.md.
const ranges: readonly (readonly [
	number,
	number,
	number,
	1 | 2 | 3,
	number,
])[] = [
	[91095, 1, 30, 1, 105912],
	[91210, 2, 16, 2, 105942],
	[91242, 1, 14, 2, 105958],
	[91211, 2, 16, 3, 105972],
	[91256, 1, 14, 3, 105988],
];
const achievements = [42701, 42702, 42703];
declare function GetAchievementCriteriaInfoByID(
	this: void,
	achievement: number,
	criterion: number,
): LuaMultiReturn<[string | undefined, number, boolean | undefined]>;

export class PreyTargetsClient {
	private readonly cache = new Map<number, PreyTarget>();
	invalidate(): void {
		this.cache.clear();
	}
	target(questID: number): PreyTarget | undefined {
		const cached = this.cache.get(questID);
		if (cached) return cached;
		const result = this.lookup(questID);
		if (result) this.cache.set(questID, result);
		return result;
	}
	private lookup(questID: number): PreyTarget | undefined {
		for (const [start, step, count, difficulty, firstCriterion] of ranges) {
			const offset = (questID - start) / step;
			if (offset >= 0 && offset < count && offset === Math.floor(offset)) {
				const achievement = achievements.at(difficulty - 1);
				if (achievement)
					return this.read(difficulty, achievement, firstCriterion + offset);
			}
		}
		if (questID >= 95021 && questID <= 95024)
			return this.read(
				3,
				questID <= 95022 ? 63452 : 63451,
				115704 + questID - 95021,
			);
		return undefined;
	}
	private read(
		difficulty: 1 | 2 | 3,
		achievement: number,
		criterion: number,
	): PreyTarget {
		const [, , , completed] = GetAchievementInfo(achievement);
		const [, , criterionCompleted] = GetAchievementCriteriaInfoByID(
			achievement,
			criterion,
		);
		return {
			difficulty,
			needed: completed === false && criterionCompleted === false,
		};
	}
}
