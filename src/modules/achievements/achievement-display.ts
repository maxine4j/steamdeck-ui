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
	pending?: boolean;
	id: string;
	name: string;
	sections: AchievementSection[];
}
const membership = new Map<number, (typeof achievementGroups)[number]>();
const memberRanks = new Map<number, number>();
const pageRanks = new Map<string, number>();
const sectionRanks = new Map<string, number>();
const groupRanks = new Map<string, number>();
for (const group of achievementGroups) {
	if (!pageRanks.has(group.category))
		pageRanks.set(group.category, pageRanks.size);
	const section = `${group.category}\n${group.section === group.category ? "General" : group.section}`;
	if (!sectionRanks.has(section)) sectionRanks.set(section, sectionRanks.size);
	const key = `${section}\n${group.name}`;
	if (!groupRanks.has(key)) groupRanks.set(key, groupRanks.size);
	group.ids.forEach((id, rank) => {
		if (!memberRanks.has(id)) memberRanks.set(id, rank);
	});
}
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
export function achievementPageName(category: AchievementCategory): string {
	return rootNames.get(category.id) ?? category.name;
}
export function achievementPageFor(
	id: number,
	category: AchievementCategory,
): string {
	return membership.get(id)?.category ?? achievementPageName(category);
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
	pages.sort(
		(a, b) =>
			(pageRanks.get(a.id) ?? pageRanks.size) -
			(pageRanks.get(b.id) ?? pageRanks.size),
	);
	for (const page of pages) {
		page.sections.sort(
			(a, b) =>
				(sectionRanks.get(`${page.id}\n${a.name}`) ?? -1) -
				(sectionRanks.get(`${page.id}\n${b.name}`) ?? -1),
		);
		for (const section of page.sections) {
			section.groups = section.groups.filter(
				(group) => group.achievements.length > 0,
			);
			section.groups.sort(
				(a, b) =>
					(groupRanks.get(`${page.id}\n${section.name}\n${a.name}`) ?? -1) -
					(groupRanks.get(`${page.id}\n${section.name}\n${b.name}`) ?? -1),
			);
			for (const group of section.groups) {
				if (group.name !== "Unknown")
					group.achievements.sort(
						(a, b) =>
							(memberRanks.get(a.id) ?? 0) - (memberRanks.get(b.id) ?? 0),
					);
			}
		}
	}
	return pages;
}
