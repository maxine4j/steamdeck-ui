import { expect, it } from "vitest";
import type {
	Achievement,
	AchievementCategory,
} from "../../clients/achievements-client";
import {
	achievementCategoryTint,
	buildAchievementPages,
} from "./achievement-display";

it("gives categories distinct subtle tints, including stable colours for future categories", () => {
	const quests = achievementCategoryTint("Quests");
	expect(quests).not.toEqual(achievementCategoryTint("Exploration"));
	expect(quests.every((channel) => channel >= 0.8 && channel <= 1)).toBe(true);
	expect(achievementCategoryTint("Future category")).toEqual(
		achievementCategoryTint("Future category"),
	);
});

const achievement = (id: number, completed = false): Achievement => ({
	id,
	completed,
	name: `Achievement ${id}`,
	points: 10,
	date: "",
	description: "",
	icon: 1,
	reward: "",
});
const categories: AchievementCategory[] = [
	{ id: 92, name: "General", parent: -1 },
	{ id: 96, name: "Quests", parent: -1 },
	{ id: 99, name: "Northrend", parent: 96 },
	{ id: 97, name: "Exploration", parent: -1 },
	{ id: 100, name: "Northrend", parent: 97 },
	{ id: 999, name: "New expansion", parent: -1 },
];
it("uses Armory sections and named grids, counts live chain levels and deduplicates IDs", () => {
	const pages = buildAchievementPages(
		categories,
		new Map([
			[92, [achievement(6, true)]],
			[96, [achievement(503), achievement(503)]],
			[100, [achievement(1264, true)]],
		]),
	);
	expect(pages.map((p) => p.name)).toEqual([
		"Characters",
		"Quests",
		"Exploration",
	]);
	expect(pages.at(0)).toMatchObject({
		total: 1,
		completed: 1,
		sections: [{ name: "General", groups: [{ name: "Level" }] }],
	});
	expect(pages.at(1)?.sections.at(0)?.groups.at(0)?.name).toBe(
		"Regular Counts",
	);
	expect(pages.at(2)?.sections.at(0)?.name).toBe("Northrend");
});
it("puts unmapped achievements first in each live section and keeps future categories", () => {
	const pages = buildAchievementPages(
		categories,
		new Map([
			[92, [achievement(6), achievement(900000)]],
			[100, [achievement(1264), achievement(900001)]],
			[999, [achievement(900002, true)]],
		]),
	);
	expect(
		pages
			.at(0)
			?.sections.at(0)
			?.groups.map((g) => g.name),
	).toEqual(["Unknown", "Level"]);
	expect(
		pages
			.at(1)
			?.sections.at(0)
			?.groups.map((g) => g.name),
	).toEqual(["Unknown", "General"]);
	expect(pages.at(2)).toMatchObject({
		name: "New expansion",
		total: 1,
		completed: 1,
		sections: [{ groups: [{ name: "Unknown" }] }],
	});
});
it("moves mapped achievements to their curated category without losing orphaned live categories", () => {
	const pages = buildAchievementPages(
		[...categories, { id: 888, name: "Future child", parent: 777 }],
		new Map([
			[92, [achievement(503)]],
			[888, [achievement(900003)]],
		]),
	);
	expect(pages.map((p) => p.name)).toEqual(["Quests", "Future child"]);
});
it("keeps completion counts when filtering and omits empty grids", () => {
	const pages = buildAchievementPages(
		categories,
		new Map([[92, [achievement(6, true), achievement(7)]]]),
		true,
	);
	expect(pages.at(0)).toMatchObject({ total: 2, completed: 1 });
	expect(
		pages
			.at(0)
			?.sections.at(0)
			?.groups.at(0)
			?.achievements.map((a) => a.id),
	).toEqual([7]);
	expect(pages.at(0)?.sections.at(0)?.groups.at(0)).toMatchObject({
		total: 2,
		completed: 1,
	});
});

it("places unknown IDs in newly introduced native sections ahead of the curated sections", () => {
	const pages = buildAchievementPages(
		[...categories, { id: 1001, name: "Future continent", parent: 97 }],
		new Map([
			[100, [achievement(1264)]],
			[1001, [achievement(900004)]],
		]),
	);
	expect(pages.at(0)?.sections.map((s) => s.name)).toEqual([
		"Future continent",
		"Northrend",
	]);
	expect(pages.at(0)?.sections.at(0)?.groups.at(0)?.name).toBe("Unknown");
});

it("uses mapped live members to place new IDs in a curated section despite native naming differences", () => {
	const localized = categories.map((c) =>
		c.id === 100 ? { ...c, name: "Wrath of the Lich King" } : c,
	);
	const pages = buildAchievementPages(
		localized,
		new Map([[100, [achievement(1264), achievement(900005)]]]),
	);
	expect(pages.at(0)?.sections.map((s) => s.name)).toEqual(["Northrend"]);
	expect(
		pages
			.at(0)
			?.sections.at(0)
			?.groups.map((g) => g.name),
	).toEqual(["Unknown", "General"]);
});
