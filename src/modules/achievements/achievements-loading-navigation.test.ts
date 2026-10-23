import { afterEach, expect, it, vi } from "vitest";
import type {
	Achievement,
	IAchievementsClient,
} from "../../clients/achievements-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { AchievementsPanel } from "./achievements-panel";

afterEach(() => vi.restoreAllMocks());
function setup(recent: number[] = []) {
	for (const method of [
		"fill",
		"inset",
		"setWindowBackground",
		"setParent",
		"layout",
		"setColor",
		"setBorder",
		"setButtonBackground",
		"setAtlasBackground",
		"setFocused",
		"setLabel",
		"setLabelWordWrap",
		"setIcon",
		"setOpacity",
		"setTooltip",
		"setHoverTooltip",
		"setScrollContent",
		"clampScroll",
		"resetScroll",
		"revealVerticalRange",
		"onSizeChanged",
		"onVerticalScroll",
		"onClick",
		"show",
		"hide",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	vi.spyOn(Frame.prototype, "getSize").mockReturnValue({
		width: 500,
		height: 800,
	});
	let top = 0;
	vi.spyOn(Frame.prototype, "getVisibleVerticalRange").mockImplementation(
		() => ({
			top,
			bottom: top + 800,
		}),
	);
	vi.spyOn(Frame.prototype, "revealVerticalRange").mockImplementation(
		(start, end) => {
			if (start < top) top = start;
			else if (end > top + 800) top = end - 800;
		},
	);
	vi.spyOn(Frame.prototype, "labelHeight").mockReturnValue(16);
	const pending: (() => void)[] = [];
	const completions = new Map<number, (rows: Achievement[]) => void>();
	const client: IAchievementsClient = {
		categories: () => [
			{ id: 92, name: "General", parent: -1 },
			{ id: 96, name: "Quests", parent: -1 },
			{ id: 777, name: "Future", parent: -1 },
		],
		loadCategory: (id, complete) => {
			completions.set(id, complete);
			return vi.fn();
		},
		summary: () => ({
			points: 100,
			totals: { total: 2, completed: 1 },
			categories: [],
			recent: recent.map((id) => client.achievement(id)),
		}),
		totals: () => ({ total: 2, completed: 1 }),
		achievements: () => [],
		criteria: () => [],
		chain: () => [],
		categoryFor: () => 92,
		selection: (id) => id,
		achievement: (id) => ({
			id,
			name: "Level",
			completed: true,
			points: 10,
			date: "",
			description: "",
			reward: "",
			icon: 1,
		}),
	};
	const panel = new AchievementsPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		{
			nextFrame: (callback) => {
				let cancelled = false;
				pending.push(() => {
					if (!cancelled) callback();
				});
				return () => {
					cancelled = true;
				};
			},
		},
	);
	const nav = new NavigationManager(createTestEventBus());
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	panel.setNavigationChanged((id) => nav.refreshGrid("left", id));
	nav.registerGrid("left", () => panel.getNavGrid());
	nav.setActiveGrid("left");
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	return {
		panel,
		nav,
		client,
		completions,
		pending,
		flush,
		viewportTop: () => top,
	};
}

it("focuses a recent achievement in the first rendered batch and navigates from it", () => {
	const { panel, nav, client, completions, pending, flush, viewportTop } =
		setup([990199]);
	flush();
	completions.get(92)?.(
		Array.from({ length: 240 }, (_, index) =>
			client.achievement(990000 + index),
		),
	);
	flush();
	completions.get(96)?.([]);
	flush();
	completions.get(777)?.([]);
	flush();
	expect(nav.focusedId).toBe("recent-achievement-990199");
	nav.interact();
	while (
		pending.length &&
		!panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.startsWith("achievement-"))
	)
		pending.shift()?.();
	expect(nav.focusedId).toBe("achievement-990199");
	const linkedTop = viewportTop();
	expect(linkedTop).toBeGreaterThan(0);
	nav.moveLeft();
	expect(nav.focusedId).toBe("achievement-990198");
	expect(viewportTop()).toBe(linkedTop);
	flush();
	expect(nav.focusedId).toBe("achievement-990198");
	expect(viewportTop()).toBe(linkedTop);
	nav.destroy();
	panel.destroy();
});

it("activates real deferred category controls before the scan completes and keeps them active across count updates", () => {
	const { panel, nav, client, completions, flush } = setup();
	flush();
	expect(completions.has(92)).toBe(true);
	expect(completions.has(96)).toBe(false);
	expect(nav.focusedId).toBe("summary-category-Characters");
	completions.get(92)?.([client.achievement(6)]);
	expect(nav.focusedId).toBe("summary-category-Characters");
	nav.moveRight();
	expect(nav.focusedId).toBe("summary-category-Quests");
	flush();
	expect(nav.focusedId).toBe("summary-category-Quests");
	nav.interact();
	expect(nav.focusedId).toBe("achievements-back");
	expect(completions.has(777)).toBe(false);
	nav.destroy();
	panel.destroy();
});

it("keeps controller movement from a recent destination when the remaining catalog finishes loading", () => {
	const { panel, nav, client, completions, flush } = setup([990199]);
	flush();
	completions.get(92)?.(
		Array.from({ length: 240 }, (_, index) =>
			client.achievement(990000 + index),
		),
	);
	flush();
	nav.interact();
	flush();
	expect(nav.focusedId).toBe("achievement-990199");
	nav.moveLeft();
	expect(nav.focusedId).toBe("achievement-990198");
	completions.get(96)?.([]);
	flush();
	completions.get(777)?.([]);
	flush();
	expect(nav.focusedId).toBe("achievement-990198");
	nav.moveLeft();
	expect(nav.focusedId).toBe("achievement-990197");
	nav.destroy();
	panel.destroy();
});

it("retains summary focus through the final cold-load publication with the real deferred list", () => {
	const { panel, nav, client, completions, pending, flush } = setup();
	flush();
	completions.get(92)?.([client.achievement(6)]);
	flush();
	nav.moveRight();
	expect(nav.focusedId).toBe("summary-category-Quests");
	completions.get(96)?.([client.achievement(503)]);
	flush();
	completions.get(777)?.([]);
	while (pending.length) {
		pending.shift()?.();
		expect(nav.focusedId).toBe("summary-category-Quests");
	}
	nav.destroy();
	panel.destroy();
});
