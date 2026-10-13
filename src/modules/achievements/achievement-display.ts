import type {
	Achievement,
	AchievementCategory,
	AchievementTotals,
} from "../../clients/achievements-client";
import { achievementGroups } from "./achievement-groups";
export interface AchievementGroup extends AchievementTotals {
	name: string;
	achievements: Achievement[];
}
export interface AchievementSection extends AchievementTotals {
	name: string;
	groups: AchievementGroup[];
}
export interface AchievementPage extends AchievementTotals {
	id: string;
	name: string;
	sections: AchievementSection[];
}
const membership = new Map<number, (typeof achievementGroups)[number]>();
for (const group of achievementGroups)
	for (const id of group.ids) {
		if (!membership.has(id)) membership.set(id, group);
	}
const rootNames = new Map<number, string>([
	[92, "Characters"],
	[96, "Quests"],
	[97, "Exploration"],
	[95, "Player vs. Player"],
	[168, "Dungeons & Raids"],
	[169, "Professions"],
	[201, "Reputation"],
	[155, "World Events"],
	[15117, "Pet Battles"],
	[15522, "Collections"],
	[15246, "Expansion Features"],
	[15234, "Feats of Strength"],
	[15233, "Legacy"],
]);
export function achievementRoot(
	categories: readonly AchievementCategory[],
	id: number,
): AchievementCategory | undefined {
	let category = categories.find((c) => c.id === id);
	const visited = new Set<number>();
	while (category && category.parent !== -1 && !visited.has(category.id)) {
		visited.add(category.id);
		const parent = categories.find((c) => c.id === category?.parent);
		if (!parent) break;
		category = parent;
	}
	return category;
}
export function buildAchievementPages(
	categories: readonly AchievementCategory[],
	entries: ReadonlyMap<number, readonly Achievement[]>,
	incomplete = false,
): AchievementPage[] {
	const pages: AchievementPage[] = [];
	const seen = new Set<number>();
	// Infer newly introduced root categories from mapped live members, rather than
	// guessing from ID ranges or localized Blizzard category names.
	const nativeNames = new Map(rootNames);
	for (const [id, achievements] of entries) {
		const root = achievementRoot(categories, id);
		if (!root || nativeNames.has(root.id)) continue;
		const names = new Set(
			achievements
				.map((a) => membership.get(a.id)?.category)
				.filter((name): name is string => name !== undefined),
		);
		if (names.size === 1)
			nativeNames.set(root.id, [...names].at(0) ?? root.name);
	}
	const nativeSections = new Map<number, string>();
	for (const [id, achievements] of entries) {
		const root = achievementRoot(categories, id);
		if (!root) continue;
		const name = nativeNames.get(root.id) ?? root.name;
		const sections = new Set(
			achievements.flatMap((achievement) => {
				const mapped = membership.get(achievement.id);
				return mapped?.category === name
					? [mapped.section === mapped.category ? "General" : mapped.section]
					: [];
			}),
		);
		const section = [...sections].at(0);
		if (sections.size === 1 && section !== undefined)
			nativeSections.set(id, section);
	}
	for (const [categoryId, achievements] of entries) {
		const native = categories.find((c) => c.id === categoryId);
		const root = achievementRoot(categories, categoryId);
		for (const achievement of achievements) {
			if (seen.has(achievement.id)) continue;
			seen.add(achievement.id);
			const mapped = membership.get(achievement.id);
			const name =
				mapped?.category ??
				(root ? (nativeNames.get(root.id) ?? root.name) : "Unknown");
			const sectionName = mapped
				? mapped.section === mapped.category
					? "General"
					: mapped.section
				: (nativeSections.get(categoryId) ??
					(native?.id === root?.id ? "General" : (native?.name ?? "Unknown")));
			let page = pages.find((p) => p.id === name);
			if (!page) {
				page = { id: name, name, sections: [], total: 0, completed: 0 };
				pages.push(page);
			}
			let section = page.sections.find((s) => s.name === sectionName);
			if (!section) {
				section = { name: sectionName, groups: [], total: 0, completed: 0 };
				page.sections.push(section);
			}
			page.total++;
			section.total++;
			if (achievement.completed) {
				page.completed++;
				section.completed++;
			}
			const groupName = mapped?.name ?? "Unknown";
			let group = section.groups.find((g) => g.name === groupName);
			if (!group) {
				group = { name: groupName, achievements: [], total: 0, completed: 0 };
				if (mapped) section.groups.push(group);
				else section.groups.unshift(group);
			}
			group.total++;
			if (achievement.completed) group.completed++;
			if (!incomplete || !achievement.completed)
				group.achievements.push(achievement);
		}
	}
	// Preserve the reference's order, independent of completion or live API order.
	const pageOrder = [...new Set(achievementGroups.map((g) => g.category))];
	pages.sort(
		(a, b) =>
			(pageOrder.includes(a.id) ? pageOrder.indexOf(a.id) : pageOrder.length) -
			(pageOrder.includes(b.id) ? pageOrder.indexOf(b.id) : pageOrder.length),
	);
	for (const page of pages) {
		const definitions = achievementGroups.filter((g) => g.category === page.id);
		const sections = [
			...new Set(
				definitions.map((g) =>
					g.section === g.category ? "General" : g.section,
				),
			),
		];
		page.sections.sort(
			(a, b) =>
				(sections.includes(a.name) ? sections.indexOf(a.name) : -1) -
				(sections.includes(b.name) ? sections.indexOf(b.name) : -1),
		);
		for (const section of page.sections) {
			section.groups = section.groups.filter(
				(group) => group.achievements.length > 0,
			);
			const groups = definitions
				.filter(
					(g) =>
						(g.section === g.category ? "General" : g.section) === section.name,
				)
				.map((g) => g.name);
			section.groups.sort(
				(a, b) =>
					(a.name === "Unknown" ? -1 : groups.indexOf(a.name)) -
					(b.name === "Unknown" ? -1 : groups.indexOf(b.name)),
			);
			for (const group of section.groups) {
				const ids = definitions.find(
					(g) =>
						(g.section === g.category ? "General" : g.section) ===
							section.name && g.name === group.name,
				)?.ids;
				if (ids)
					group.achievements.sort(
						(a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
					);
			}
		}
	}
	return pages;
}
