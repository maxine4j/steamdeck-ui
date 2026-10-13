import { beforeEach, expect, it, vi } from "vitest";
import type {
	Achievement,
	IAchievementsClient,
} from "../../clients/achievements-client";
import { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { AchievementsPanel } from "./achievements-panel";

const { lists, frames, reveal, resizeCallbacks } = vi.hoisted(() => ({
	resizeCallbacks: new Map<string, () => void>(),
	reveal: vi.fn(),
	lists: new Map<string, { rows: readonly ListRow[]; mounted: boolean }>(),
	frames: new Map<
		string,
		{
			visible: boolean;
			layouts: number[][];
			labels: Map<string, string>;
			opacity: number;
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		state = {
			visible: false,
			layouts: [] as number[][],
			labels: new Map<string, string>(),
			opacity: 1,
		};
		constructor(public id: string) {
			frames.set(id, this.state);
		}
		fill() {}
		inset() {}
		setParent() {}
		setColor() {}
		setWindowBackground() {}
		setButtonBackground() {}
		setFocused() {}
		setIcon() {}
		setScrollContent() {}
		clampScroll() {}
		resetScroll() {}
		onSizeChanged(callback: () => void) {
			resizeCallbacks.set(this.id, callback);
		}
		onClick() {}
		setHoverTooltip() {}
		setOpacity(value: number) {
			this.state.opacity = value;
		}
		setLabel(id: string, text: string) {
			this.state.labels.set(id, text);
		}
		layout(
			width: number,
			height: number,
			_anchor?: string,
			_parent?: unknown,
			x = 0,
			y = 0,
		) {
			this.state.layouts.push([width, height, x, y]);
		}
		revealVerticalRange = reveal;
		show() {
			this.state.visible = true;
		}
		hide() {
			this.state.visible = false;
		}
		destroy() {}
		getSize() {
			return { width: 500, height: 800 };
		}
		navigationNode(navId: string, onInteract: () => void, focus?: () => void) {
			return { navId, onInteract, onFocus: () => focus?.(), onBlur() {} };
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
		resetScroll() {}
		revealRow() {}
		destroy() {}
		mount() {
			this.state.mounted = true;
		}
		unmount() {
			this.state.mounted = false;
		}
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
beforeEach(() => {
	lists.clear();
	frames.clear();
	reveal.mockClear();
	resizeCallbacks.clear();
});
const achievement = (id: number, completed = false): Achievement => ({
	id,
	name: `Achievement ${id}`,
	points: 10,
	completed,
	date: completed ? "1/1/2026" : "",
	description: "Explore the world",
	reward: "Title",
	icon: 1,
});
function setup() {
	const pending: { callback: () => void; cancelled: boolean }[] = [];
	const client: IAchievementsClient = {
		categories: () => [
			{ id: 92, name: "General", parent: -1 },
			{ id: 96, name: "Quests", parent: -1 },
			{ id: 99, name: "Northrend", parent: 96 },
		],
		totals: () => ({ total: 2, completed: 1 }),
		achievements: vi.fn((category) =>
			category === 92
				? [achievement(6, true), achievement(7)]
				: category === 96
					? [achievement(503), achievement(900000)]
					: [achievement(900001)],
		),
		summary: vi.fn(() => ({
			points: 100,
			totals: { total: 20, completed: 5 },
			recent: [],
			categories: [],
		})),
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
		categoryFor: () => 96,
		achievement: (id) => achievement(id),
		selection: (id) => id,
	};
	const close = vi.fn();
	const panel = new AchievementsPanel({} as IFramePoolManager, client, close, {
		nextFrame(callback) {
			const task = { callback, cancelled: false };
			pending.push(task);
			return () => {
				task.cancelled = true;
			};
		},
	});
	const parent = new Frame("parent", {} as IFramePoolManager);
	const step = () => {
		const task = pending.shift();
		if (task && !task.cancelled) task.callback();
	};
	const flush = () => {
		for (let i = 0; pending.length && i < 1000; i++) step();
		expect(pending).toHaveLength(0);
	};
	const activate = (id: string) => {
		const node = panel
			.getNavGrid()
			.flat()
			.find((n) => n.navId === id);
		expect(node, id).toBeDefined();
		node?.onInteract();
		flush();
	};
	panel.onMount(parent);
	flush();
	return { panel, client, close, parent, flush, step, activate };
}
it("opens a single-column summary with progress buttons and drills into category grids", () => {
	const { panel, activate } = setup();
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "summary-category-Characters"),
	).toMatchObject({ label: "Characters", progress: { value: 0.5 } });
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).not.toContain("achievements-filter");
	expect(lists.has("achievements-categories")).toBe(false);
	activate("summary-category-Quests");
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).toEqual([
		"achievements-back",
		"achievements-filter",
		"achievement-900000",
		"achievement-503",
		"achievement-900001",
	]);
	const labels = [...frames.values()].flatMap((f) => [...f.labels.values()]);
	expect(labels).toContain("General");
	expect(labels).toContain("Regular Counts");
	expect(labels).toContain("Unknown");
});
it("opens lazy achievement details, criteria and rewards; Back walks to grid, summary, then closes", () => {
	const { panel, client, activate, close, flush } = setup();
	activate("summary-category-Quests");
	expect(client.criteria).not.toHaveBeenCalled();
	const tooltip = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievement-503")
		?.tooltipItem?.();
	expect(tooltip).toEqual({
		text: expect.stringContaining("Explore the world"),
	});
	activate("achievement-503");
	expect(client.criteria).toHaveBeenCalledWith(503);
	expect(
		lists.get("achievements-list")?.rows.find((r) => r.id === "criterion-503-0")
			?.progress?.value,
	).toBe(0.6);
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "achievement-detail")?.detail,
	).toContain("Title");
	panel.onBack();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "achievement-503"),
	).toBe(true);
	panel.onBack();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "summary-category-Quests"),
	).toBe(true);
	panel.onBack();
	expect(close).toHaveBeenCalledOnce();
});
it("filters completed icons without rescanning, and reuses controls when moving between pages", () => {
	const { panel, client, activate } = setup();
	activate("summary-category-Characters");
	expect(frames.get("achievements-icon-0")?.opacity).toBe(1);
	expect(frames.get("achievements-icon-1")?.opacity).toBe(0.25);
	activate("achievements-filter");
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).not.toContain("achievement-6");
	expect(client.achievements).toHaveBeenCalledTimes(3);
	const count = frames.size;
	panel.onBack();
	activate("summary-category-Characters");
	expect(frames.size).toBe(count);
});
it("fits the left container, has spatial grid columns and reveals focused icons", () => {
	const { panel, client, flush, activate } = setup();
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92
			? Array.from({ length: 12 }, (_, i) => achievement(900010 + i))
			: [],
	);
	panel.refresh();
	flush();
	activate("summary-category-Characters");
	const grid = panel.getNavGrid().slice(1);
	expect(grid.map((row) => row.length)).toEqual([10, 2]);
	expect(grid.at(0)?.map((n) => n.navColumn)).toEqual([
		0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
	]);
	for (const state of frames.values())
		for (const [width, , x] of state.layouts)
			expect((width ?? 0) + (x ?? 0)).toBeLessThanOrEqual(500);
	grid.at(-1)?.at(-1)?.onFocus();
	expect(reveal).toHaveBeenCalledWith(
		expect.any(Number),
		expect.any(Number),
		expect.any(Number),
	);
});
it("defers hidden refreshes, cancels scans on unmount and selects external achievements in their curated page", () => {
	const { panel, client, parent, flush } = setup();
	panel.onUnmount();
	panel.refresh();
	flush();
	expect(client.summary).toHaveBeenCalledOnce();
	expect(panel.getNavGrid()).toEqual([]);
	panel.selectAchievement(503);
	panel.onMount(parent);
	flush();
	expect(client.summary).toHaveBeenCalledTimes(2);
	expect(client.criteria).toHaveBeenCalledWith(503);
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "achievement-detail")?.label,
	).toContain("503");
	panel.onBack();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "achievement-503"),
	).toBe(true);
});
it("publishes only rendered controls and cancels pending render work", () => {
	const { panel, client, flush, step } = setup();
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92
			? Array.from({ length: 40 }, (_, i) => achievement(900100 + i))
			: [],
	);
	panel.refresh();
	step();
	step();
	step();
	step();
	flush();
	panel.selectCategory(92);
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((n) => n.navId.startsWith("achievement-")),
	).toHaveLength(0);
	step();
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((n) => n.navId.startsWith("achievement-")).length,
	).toBeLessThan(40);
	panel.onUnmount();
	flush();
	expect(panel.getNavGrid()).toEqual([]);
});

it("selects a category whose achievements exist only in descendants", () => {
	const { panel, client, flush } = setup();
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 99 ? [achievement(503)] : [],
	);
	panel.refresh();
	flush();
	panel.selectCategory(96);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "achievement-503"),
	).toBe(true);
});
it("returns to the top-level summary after closing the container", () => {
	const { panel, parent, flush, activate } = setup();
	activate("summary-category-Quests");
	panel.onUnmount();
	panel.onContainerClosed();
	panel.onMount(parent);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "summary-category-Quests"),
	).toBe(true);
});
it("shows an empty state when every achievement is completed", () => {
	const { panel, client, flush, activate } = setup();
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92 ? [achievement(6, true)] : [],
	);
	panel.refresh();
	flush();
	activate("summary-category-Characters");
	activate("achievements-filter");
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).toEqual(["achievements-back", "achievements-filter"]);
	expect(frames.get("achievements-content")?.labels.get("empty")).toBe(
		"No achievements to display",
	);
});
it("can inspect an earlier completed chain level without jumping to the latest level", () => {
	const { panel, client, flush, activate } = setup();
	vi.spyOn(client, "chain").mockReturnValue([
		achievement(6, true),
		achievement(7, true),
	]);
	vi.spyOn(client, "selection").mockReturnValue(7);
	panel.selectAchievement(7);
	flush();
	activate("chain-6");
	expect(client.criteria).toHaveBeenLastCalledWith(6);
});
it("reflows grids when the host changes size", () => {
	const { panel, client, flush, activate } = setup();
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92
			? Array.from({ length: 12 }, (_, i) => achievement(900500 + i))
			: [],
	);
	panel.refresh();
	flush();
	activate("summary-category-Characters");
	vi.spyOn(Frame.prototype, "getSize").mockReturnValue({
		width: 300,
		height: 800,
	});
	const resize = resizeCallbacks.get("achievements");
	expect(resize).toBeDefined();
	resize?.();
	flush();
	expect(
		panel
			.getNavGrid()
			.slice(1)
			.map((row) => row.length),
	).toEqual([5, 5, 2]);
	vi.restoreAllMocks();
});
it("invalidates old icon actions and tooltips when the grid is replaced", () => {
	const { panel, client, activate } = setup();
	activate("summary-category-Characters");
	const old = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievement-6");
	activate("achievements-filter");
	old?.onInteract();
	expect(client.criteria).not.toHaveBeenCalled();
	expect(old?.tooltipItem?.()).toBeUndefined();
});
it("keeps the current page usable while refreshing completion data in the background", () => {
	const { panel, client, activate, step, flush } = setup();
	activate("summary-category-Quests");
	panel.refresh();
	step();
	const icon = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievement-503");
	expect(icon).toBeDefined();
	expect(icon?.tooltipItem?.()).toEqual({
		text: expect.stringContaining("Explore the world"),
	});
	icon?.onInteract();
	expect(client.criteria).toHaveBeenCalledWith(503);
	flush();
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "achievement-detail"),
	).toBeDefined();
});
it("restarts an interrupted scan when reopened instead of retaining a partial catalog", () => {
	const { panel, client, parent, step, flush } = setup();
	panel.refresh();
	step();
	step();
	const calls = vi.mocked(client.achievements).mock.calls.length;
	panel.onUnmount();
	flush();
	expect(client.achievements).toHaveBeenCalledTimes(calls);
	panel.onMount(parent);
	flush();
	expect(client.achievements).toHaveBeenCalledTimes(calls + 3);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "summary-category-Quests"),
	).toBe(true);
});
