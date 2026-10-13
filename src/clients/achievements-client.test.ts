import { afterEach, expect, it, vi } from "vitest";
import { AchievementsClient } from "./achievements-client";
import type { ITaskScheduler } from "./task-scheduler";

afterEach(() => vi.unstubAllGlobals());
const setup = (scheduler: ITaskScheduler = { nextFrame: vi.fn() }) => {
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
	return new AchievementsClient(scheduler);
};
it("bounds category and chain API work per frame and cancels the latest continuation", () => {
	const pending: (() => void)[] = [];
	const client = setup({
		nextFrame: (callback) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	});
	const read = vi.fn((id: number, index?: number) => [
		index ?? id,
		"Achievement",
		10,
		false,
		0,
		0,
		0,
		"",
		0,
		1,
		"",
	]);
	const count = vi.fn(() => [100, 0, 100]);
	const previous = vi.fn(() => undefined);
	const next = vi.fn(() => [undefined, false]);
	vi.stubGlobal("GetAchievementInfo", read);
	vi.stubGlobal("GetCategoryNumAchievements", count);
	vi.stubGlobal("GetPreviousAchievement", previous);
	vi.stubGlobal("GetNextAchievement", next);
	const complete = vi.fn();
	const progress = vi.fn();
	const cancel = client.loadCategory(92, complete, progress);
	expect(read).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(
		read.mock.calls.length +
			count.mock.calls.length +
			previous.mock.calls.length +
			next.mock.calls.length,
	).toBeGreaterThan(40);
	expect(
		read.mock.calls.length +
			count.mock.calls.length +
			previous.mock.calls.length +
			next.mock.calls.length,
	).toBeLessThanOrEqual(60);
	expect(complete).not.toHaveBeenCalled();
	expect(progress).toHaveBeenCalled();
	const calls = read.mock.calls.length;
	cancel();
	while (pending.length) pending.shift()?.();
	expect(read).toHaveBeenCalledTimes(calls);
	expect(complete).not.toHaveBeenCalled();
});
it("publishes category rows before completion", () => {
	const pending: (() => void)[] = [];
	const client = setup({
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	vi.stubGlobal("GetCategoryNumAchievements", () => [100, 0, 100]);
	const complete = vi.fn();
	const progress = vi.fn();
	client.loadCategory(92, complete, progress);
	pending.shift()?.();
	expect(complete).not.toHaveBeenCalled();
	expect(progress.mock.lastCall?.at(2)?.length).toBeGreaterThan(0);
	while (pending.length) pending.shift()?.();
	expect(
		progress.mock.calls
			.flatMap((call) => call.at(2))
			.map((row: { id: number }) => row.id),
	).toEqual(expect.arrayContaining([921, 922]));
});
it("does not walk a whole chain again for each category row already loaded", () => {
	const pending: (() => void)[] = [];
	const client = setup({
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	vi.stubGlobal("GetCategoryNumAchievements", () => [50, 0, 50]);
	vi.stubGlobal("GetAchievementInfo", (id: number, index?: number) => [
		index ?? id,
		"Achievement",
		10,
		false,
		0,
		0,
		0,
		"",
		0,
		1,
		"",
	]);
	const previous = vi.fn((id: number) => (id > 1 ? id - 1 : undefined));
	const next = vi.fn((id: number) => [id < 50 ? id + 1 : undefined, false]);
	vi.stubGlobal("GetPreviousAchievement", previous);
	vi.stubGlobal("GetNextAchievement", next);
	const complete = vi.fn();
	client.loadCategory(92, complete);
	while (pending.length) pending.shift()?.();
	expect(complete.mock.lastCall?.at(0)).toHaveLength(50);
	expect(
		previous.mock.calls.length + next.mock.calls.length,
	).toBeLessThanOrEqual(51);
});
it("loads an arbitrarily long chain across frames without dropping or duplicating levels", () => {
	const pending: (() => void)[] = [];
	const client = setup({
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	vi.stubGlobal("GetCategoryNumAchievements", () => [1, 0, 1]);
	vi.stubGlobal("GetAchievementInfo", (id: number, index?: number) => [
		index ? 25 : id,
		"Achievement",
		10,
		false,
		0,
		0,
		0,
		"",
		0,
		1,
		"",
	]);
	vi.stubGlobal("GetPreviousAchievement", (id: number) =>
		id > 1 ? id - 1 : undefined,
	);
	vi.stubGlobal("GetNextAchievement", (id: number) => [
		id < 50 ? id + 1 : undefined,
		false,
	]);
	const complete = vi.fn();
	client.loadCategory(92, complete);
	pending.shift()?.();
	expect(complete).not.toHaveBeenCalled();
	while (pending.length) pending.shift()?.();
	expect(
		complete.mock.lastCall?.at(0).map((a: { id: number }) => a.id),
	).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
});
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
it("uses recent achievements and includes every live top-level category", () => {
	const client = setup();
	expect(client.summary().recent.map((a) => a.id)).toEqual([921, 961, 6]);
	expect(client.summary().categories.map((c) => c.id)).toEqual([92, 96, 15234]);
});

it("retains new nested categories and includes their totals", () => {
	const client = setup();
	vi.stubGlobal("GetCategoryList", () => [92, 12, 999, 1000]);
	vi.stubGlobal("GetCategoryInfo", (id: number) => [
		`Category ${id}`,
		id === 12 ? 92 : id === 999 ? 12 : -1,
	]);
	expect(client.categories().map((c) => c.id)).toEqual([92, 12, 999, 1000]);
	expect(client.totals(92)).toEqual({ total: 7, completed: 3 });
	expect(client.summary().categories.map((c) => c.id)).toEqual([92, 1000]);
});

it("enumerates all chain levels once for completion grids", () => {
	const client = setup();
	vi.stubGlobal("GetCategoryNumAchievements", () => [1, 1, 0]);
	vi.stubGlobal("GetPreviousAchievement", (id: number) =>
		id === 921 ? 920 : undefined,
	);
	vi.stubGlobal("GetNextAchievement", (id: number) => [
		id === 921 ? 922 : undefined,
		false,
	]);
	expect(client.achievements(92, false).map((a) => a.id)).toEqual([
		920, 921, 922,
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
it("reads headline summary data without scanning category totals when requested", () => {
	const client = setup();
	const categories = vi.fn(() => []);
	const totals = vi.fn(() => [0, 0, 0]);
	vi.stubGlobal("GetCategoryList", categories);
	vi.stubGlobal("GetCategoryNumAchievements", totals);
	expect(client.summary(false).points).toBe(100);
	expect(categories).not.toHaveBeenCalled();
	expect(totals).not.toHaveBeenCalled();
});
