import { expect, it, vi } from "vitest";
import type {
	Achievement,
	IAchievementsClient,
} from "../../clients/achievements-client";
import { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { AchievementsPanel } from "./achievements-panel";

const { lists } = vi.hoisted(() => ({
	lists: new Map<string, { rows: readonly ListRow[]; mounted: boolean }>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		fill() {}
		inset() {}
		setParent() {}
		layout() {}
		setColor() {}
		setBlackBackground() {}
		setLabel() {}
		onClick() {}
		show() {}
		hide() {}
		destroy() {}
		onSizeChanged() {}
		getSize() {
			return { width: 1200, height: 800 };
		}
	},
}));
vi.mock("../../ui/components/scroll-list", () => ({
	ScrollList: class {
		state = { rows: [] as readonly ListRow[], mounted: false };
		constructor(id: string) {
			lists.set(id, this.state);
		}
		setRows(rows: readonly ListRow[]) {
			this.state.rows = rows;
		}
		setWidth() {}
		revealRow() {}
		mount() {
			this.state.mounted = true;
		}
		unmount() {
			this.state.mounted = false;
		}
		destroy() {}
		getNavGrid() {
			return this.state.mounted
				? this.state.rows
						.filter((r) => !r.heading)
						.map((r) => [
							{
								navId: r.id,
								onFocus() {},
								onBlur() {},
								onInteract: r.activate,
							},
						])
				: [];
		}
	},
}));
const achievement: Achievement = {
	id: 10,
	name: "Explorer",
	points: 10,
	completed: false,
	date: "",
	description: "Explore the world",
	reward: "Title",
	icon: 1,
};
const setup = () => {
	const pending: (() => void)[] = [];
	const client: IAchievementsClient = {
		categories: () => [
			{ id: 92, name: "General", parent: -1 },
			{ id: 12, name: "Child", parent: 92 },
			{ id: 15234, name: "Feats of Strength", parent: -1 },
		],
		totals: () => ({ total: 2, completed: 1 }),
		achievements: vi.fn(() => [achievement]),
		summary: () => ({
			points: 100,
			totals: { total: 20, completed: 5 },
			recent: [achievement],
			categories: [
				{ id: 92, name: "General", parent: -1, total: 2, completed: 1 },
			],
		}),
		criteria: vi.fn(() => [
			{
				name: "Places",
				completed: false,
				quantity: 3,
				required: 5,
				text: "3 / 5",
				progress: true,
			},
		]),
		chain: () => [],
		categoryFor: () => 92,
		achievement: () => achievement,
		selection: (id) => id,
	};
	const panel = new AchievementsPanel(
		{} as IFramePoolManager,
		client,
		vi.fn(),
		{
			nextFrame: (cb) => {
				pending.push(cb);
				return vi.fn();
			},
		},
	);
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	flush();
	return { panel, client, flush };
};
it("shows summary progress and recent achievements, then expands category children", () => {
	const { panel } = setup();
	expect(
		lists
			.get("achievements-list")
			?.rows.some(
				(r) => r.id === "summary-category-92" && r.progress?.value === 0.5,
			),
	).toBe(true);
	expect(lists.get("achievements-categories")?.rows.map((r) => r.id)).toEqual([
		"achievements-summary",
		"category-92",
		"category-15234",
	]);
	panel.selectCategory(92);
	expect(lists.get("achievements-categories")?.rows.map((r) => r.id)).toContain(
		"category-12",
	);
});
it("toggles incomplete filtering and lazily expands criteria with rewards and descriptions", () => {
	const { panel, client } = setup();
	panel.selectCategory(92);
	expect(client.criteria).not.toHaveBeenCalled();
	panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievements-filter")
		?.onInteract();
	expect(client.achievements).toHaveBeenLastCalledWith(92, true);
	const row = lists
		.get("achievements-list")
		?.rows.find((r) => r.id === "achievement-10");
	expect(row?.detail).toContain("Explore the world");
	expect(row?.detail).toContain("Title");
	row?.activate();
	expect(client.criteria).toHaveBeenCalledWith(10);
	expect(
		lists.get("achievements-list")?.rows.find((r) => r.id === "criterion-10-0")
			?.progress?.value,
	).toBe(0.6);
});

it("collapses an already selected parent when activated again", () => {
	const { panel } = setup();
	panel.selectCategory(92);
	lists
		.get("achievements-categories")
		?.rows.find((r) => r.id === "category-92")
		?.activate();
	expect(
		lists.get("achievements-categories")?.rows.map((r) => r.id),
	).not.toContain("category-12");
});
it("defers hidden refreshes and exposes two logical navigation columns", () => {
	const { panel, client, flush } = setup();
	panel.selectCategory(92);
	expect(
		panel
			.getNavGrid()
			.at(1)
			?.map((n) => n.navColumn),
	).toEqual([0, 1]);
	panel.onUnmount();
	panel.refresh();
	flush();
	expect(client.achievements).toHaveBeenCalledOnce();
	expect(panel.getNavGrid()).toEqual([]);
	panel.onMount(new Frame("parent", {} as IFramePoolManager));
	flush();
	expect(client.achievements).toHaveBeenCalledTimes(2);
});
