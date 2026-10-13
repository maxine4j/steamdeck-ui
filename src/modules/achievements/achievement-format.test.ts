import { expect, it } from "vitest";
import {
	formatAchievementNumber,
	formatAchievementProgress,
} from "./achievement-format";

it("groups points and counters with commas", () => {
	expect(formatAchievementNumber(1000)).toBe("1,000");
	expect(formatAchievementNumber(12345678)).toBe("12,345,678");
	expect(formatAchievementNumber(0)).toBe("0");
});
it("rounds progress to a whole percentage and handles empty totals", () => {
	expect(formatAchievementProgress(2000, 3000)).toBe("2,000 / 3,000 • 67%");
	expect(formatAchievementProgress(0, 0)).toBe("0 / 0 • 0%");
	expect(formatAchievementProgress(2, 10, "achievements")).toBe(
		"2 / 10 achievements • 20%",
	);
});
