import { afterEach, expect, it, vi } from "vitest";
import { AchievementsClient } from "./achievements-client";

afterEach(() => vi.unstubAllGlobals());
const setup = () => {
	vi.stubGlobal("GetCategoryList", () => [92, 12, 96, 15234]);
	vi.stubGlobal("GetCategoryInfo", (id: number) => [
		`Category ${id}`,
		id === 12 ? 92 : -1,
	]);
	vi.stubGlobal("GetCategoryNumAchievements", (id: number) =>
		id === 12 ? [3, 1, 2] : [2, 1, 1],
	);
	vi.stubGlobal("GetAchievementInfo", (id: number, index?: number) => [
		index ? id * 10 + index : id,
		`Achievement ${index ?? id}`,
		10,
		index === 1,
		10,
		12,
		26,
		"Description",
		0,
		123,
		"Reward",
	]);
	vi.stubGlobal("GetTotalAchievementPoints", () => 100);
	vi.stubGlobal("GetNumCompletedAchievements", () => [10, 4]);
	vi.stubGlobal("GetLatestCompletedAchievements", () => [921, 961, 6]);
	vi.stubGlobal("GetAchievementCategory", () => 92);
	vi.stubGlobal("GetPreviousAchievement", () => undefined);
	vi.stubGlobal("GetNextAchievement", () => [undefined, false]);
	return new AchievementsClient();
};
it("preserves Blizzard category hierarchy and includes immediate children in totals", () => {
	const client = setup();
	expect(client.categories().map((c) => c.id)).toEqual([92, 12, 96, 15234]);
	expect(client.categories().at(1)?.parent).toBe(92);
	expect(client.totals(92)).toEqual({ total: 5, completed: 2 });
});
it("enumerates category/index order and filters without changing totals", () => {
	const client = setup();
	expect(client.achievements(92, false).map((a) => a.id)).toEqual([921, 922]);
	expect(client.achievements(92, true).map((a) => a.id)).toEqual([922]);
	expect(client.totals(92)).toEqual({ total: 5, completed: 2 });
});
it("maps criteria quantities and completion without scanning collapsed achievements", () => {
	const client = setup();
	const criteria = vi.fn(() => [
		"Explore",
		0,
		false,
		3,
		10,
		"",
		0,
		0,
		"3 / 10",
	]);
	vi.stubGlobal("GetAchievementNumCriteria", () => 1);
	vi.stubGlobal("GetAchievementCriteriaInfo", criteria);
	client.achievements(92, false);
	expect(criteria).not.toHaveBeenCalled();
	expect(client.criteria(922)).toEqual([
		{
			name: "Explore",
			completed: false,
			quantity: 3,
			required: 10,
			text: "3 / 10",
			progress: false,
			achievement: undefined,
		},
	]);
});
it("uses recent achievements and Blizzard summary category order", () => {
	const client = setup();
	expect(client.summary().recent.map((a) => a.id)).toEqual([921, 961, 6]);
	expect(client.summary().categories.map((c) => c.id)).toEqual([
		92, 96, 97, 15522, 95, 168, 169, 201, 155, 15117, 15246,
	]);
});

it("uses Blizzard's incomplete offset even when chain rows have mixed completion states", () => {
	const client = setup();
	vi.stubGlobal("GetCategoryNumAchievements", () => [4, 1, 2]);
	vi.stubGlobal("GetAchievementInfo", (_id: number, index: number) => [
		index,
		`Row ${index}`,
		10,
		false,
		undefined,
		undefined,
		undefined,
		"",
		0,
		1,
		"",
	]);
	expect(client.achievements(92, true).map((a) => a.id)).toEqual([3, 4]);
});
it("selects the first incomplete chain level rather than a locked later level", () => {
	const client = setup();
	vi.stubGlobal("GetPreviousAchievement", (id: number) =>
		id > 1 ? id - 1 : undefined,
	);
	vi.stubGlobal("GetAchievementInfo", (id: number) => [
		id,
		`Row ${id}`,
		10,
		id === 1,
		undefined,
		undefined,
		undefined,
		"",
		0,
		1,
		"",
	]);
	expect(client.selection(3)).toBe(2);
});
it("preserves criterion completion for meta achievements and progress flags", () => {
	const client = setup();
	vi.stubGlobal("EVALUATION_TREE_FLAG_PROGRESS_BAR", 128);
	vi.stubGlobal("GetAchievementNumCriteria", () => 1);
	vi.stubGlobal("GetAchievementCriteriaInfo", () => [
		"Meta",
		8,
		false,
		4,
		10,
		"",
		128,
		42,
		"4 / 10",
	]);
	expect(client.criteria(10).at(0)).toMatchObject({
		completed: false,
		progress: true,
		achievement: 42,
	});
});

it("reads the category hierarchy once when calculating summary totals", () => {
	const client = setup();
	const categories = vi.fn(() => [92, 12, 96]);
	vi.stubGlobal("GetCategoryList", categories);
	client.summary();
	expect(categories).toHaveBeenCalledOnce();
});
