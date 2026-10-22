import { afterEach, expect, it, vi } from "vitest";
import { PreyTargetsClient } from "./prey-targets-client";

afterEach(() => vi.unstubAllGlobals());

it("identifies all three difficulties by quest ID and queries their exact target criteria", () => {
	const criteria = vi.fn(() => ["localized target", 0, false]);
	vi.stubGlobal(
		"GetAchievementInfo",
		vi.fn(() => [0, "", 0, false]),
	);
	vi.stubGlobal("GetAchievementCriteriaInfoByID", criteria);
	const client = new PreyTargetsClient();
	expect(client.target(91095)).toEqual({ difficulty: 1, needed: true });
	expect(criteria).toHaveBeenLastCalledWith(42701, 105912);
	expect(client.target(91210)).toEqual({ difficulty: 2, needed: true });
	expect(criteria).toHaveBeenLastCalledWith(42702, 105942);
	expect(client.target(91269)).toEqual({ difficulty: 3, needed: true });
	expect(criteria).toHaveBeenLastCalledWith(42703, 106001);
	expect(client.target(95022)).toEqual({ difficulty: 3, needed: true });
	expect(criteria).toHaveBeenLastCalledWith(63452, 115705);
	expect(client.target(999999)).toBeUndefined();
});

it("clears completed targets without inferring credit across difficulties or marking missing data", () => {
	const criteria = vi.fn((_achievement, criterion) => [
		"target",
		0,
		criterion === 105942,
	]);
	const achievement = vi.fn(() => [0, "", 0, false]);
	vi.stubGlobal("GetAchievementInfo", achievement);
	vi.stubGlobal("GetAchievementCriteriaInfoByID", criteria);
	const client = new PreyTargetsClient();
	expect(client.target(91210)?.needed).toBe(false);
	expect(client.target(91211)?.needed).toBe(true);
	criteria.mockReturnValue(["target", 0, undefined]);
	client.invalidate();
	expect(client.target(91211)?.needed).toBe(false);
	achievement.mockReturnValue([0, "", 0, true]);
	criteria.mockReturnValue(["target", 0, false]);
	client.invalidate();
	expect(client.target(91211)?.needed).toBe(false);
});

it("caches visible target status until achievement progress invalidates it", () => {
	const criteria = vi.fn(() => ["target", 0, false]);
	vi.stubGlobal(
		"GetAchievementInfo",
		vi.fn(() => [0, "", 0, false]),
	);
	vi.stubGlobal("GetAchievementCriteriaInfoByID", criteria);
	const client = new PreyTargetsClient();
	client.target(91095);
	client.target(91095);
	expect(criteria).toHaveBeenCalledOnce();
	criteria.mockReturnValue(["target", 0, true]);
	client.invalidate();
	expect(client.target(91095)?.needed).toBe(false);
	expect(criteria).toHaveBeenCalledTimes(2);
});
