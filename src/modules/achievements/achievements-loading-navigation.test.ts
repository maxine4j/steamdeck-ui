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
function setup() {
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
	vi.spyOn(Frame.prototype, "getVisibleVerticalRange").mockReturnValue({
		top: 0,
		bottom: 800,
	});
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
			recent: [],
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
	panel.setNavigationChanged(() => nav.refreshGrid("left"));
	nav.registerGrid("left", () => panel.getNavGrid());
	nav.setActiveGrid("left");
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	return { panel, nav, client, completions, pending, flush };
}

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
