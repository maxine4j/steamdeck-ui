import { beforeEach, expect, it, vi } from "vitest";
import type {
	Achievement,
	IAchievementsClient,
} from "../../clients/achievements-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { ListRow } from "../../ui/components/scroll-list";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { AchievementsPanel } from "./achievements-panel";

const { lists, frames, reveal, edges, resizeCallbacks, listOptions } =
	vi.hoisted(() => ({
		listOptions: new Map<string, unknown>(),
		edges: vi.fn(),
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
				click?: () => void;
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
			click: undefined as (() => void) | undefined,
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
		onClick(callback: () => void) {
			this.state.click = callback;
		}
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
		scrollToEdge = edges;
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
		constructor(
			id: string,
			_pool?: IFramePoolManager,
			_title?: string,
			_close?: () => void,
			options?: unknown,
		) {
			listOptions.set(id, options);
			lists.set(id, this.state);
		}
		setRows(rows: readonly ListRow[]) {
			this.state.rows = rows;
		}
		updateRows(rows: readonly ListRow[]) {
			this.state.rows = rows;
		}
		setWidth() {}
		columns = 1;
		setColumns(columns: number) {
			this.columns = columns;
		}
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
			if (this.state.mounted && this.columns > 1) {
				const nodes = this.state.rows
					.filter((r) => !r.heading)
					.map((r, index) => ({
						navId: r.id,
						navColumn: index % this.columns,
						onFocus() {},
						onBlur() {},
						onInteract: r.activate,
					}));
				return Array.from(
					{ length: Math.ceil(nodes.length / this.columns) },
					(_, index) =>
						nodes.slice(index * this.columns, (index + 1) * this.columns),
				);
			}
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

it("uses modern textured progress bars on achievement tiles", () => {
	setup();
	expect(listOptions.get("achievements-list")).toMatchObject({
		progressTextures: {
			fill: "ui-journeys-progressbar-fill",
			track: "ui-journeys-progressbar-BG",
		},
	});
});

it("keeps a warm achievement page unchanged until reopening after cache updates", () => {
	const { panel, parent, client, activate, flush } = setup();
	activate("summary-category-Characters");
	const first = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "achievement-6");
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	const loads = vi.mocked(client.loadCategory).mock.calls.length;
	for (let event = 0; event < 5; event++) panel.invalidate();
	flush();
	expect(client.loadCategory).toHaveBeenCalledTimes(loads);
	expect(changed).not.toHaveBeenCalled();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "achievement-6"),
	).toBe(first);
	expect(first?.tooltipItem?.()).toBeDefined();
	panel.onUnmount();
	panel.onMount(parent);
	flush();
	expect(vi.mocked(client.loadCategory).mock.calls.length).toBeGreaterThan(
		loads,
	);
	panel.destroy();
});

it("opens a complete cached achievement catalog without progressive scans or later visual updates", () => {
	const { panel, parent, client, step, flush } = setup(false);
	client.cachedCatalog = () => ({
		categories: [{ id: 92, name: "General", parent: -1 }],
		entries: new Map([[92, [achievement(6)]]]),
	});
	step();
	flush();
	expect(client.loadCategory).not.toHaveBeenCalled();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "summary-category-Characters")
		?.onInteract();
	flush();
	const first = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "achievement-6");
	expect(first).toBeDefined();
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	client.cachedCatalog = () => ({
		categories: [{ id: 92, name: "General", parent: -1 }],
		entries: new Map([[92, [achievement(6, true), achievement(7)]]]),
	});
	panel.invalidate();
	flush();
	expect(changed).not.toHaveBeenCalled();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "achievement-6"),
	).toBe(first);
	panel.onUnmount();
	panel.onMount(parent);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "achievement-7"),
	).toBe(true);
	expect(client.loadCategory).not.toHaveBeenCalled();
	panel.destroy();
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
function setup(flushLoad = true) {
	const pending: { callback: () => void; cancelled: boolean }[] = [];
	const client: IAchievementsClient = {
		loadCategory: vi.fn((category, complete, progress) => {
			const task = {
				cancelled: false,
				callback: () => {
					progress?.(1, 2, []);
					complete(client.achievements(category, false));
				},
			};
			pending.push(task);
			return () => {
				task.cancelled = true;
			};
		}),
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
	if (flushLoad) flush();
	return { panel, client, close, parent, flush, step, activate };
}

it("shows controller graphics beside achievement actions", () => {
	setup();
	expect(frames.get("achievements")?.labels.get("actions")).toContain(
		"xbox_r_a.blp:18:18|t Open category",
	);
});

it("makes summary categories interactive before scanning and uses the corner loading bar", () => {
	const { panel, client, step, flush } = setup(false);
	step();
	expect(client.achievements).not.toHaveBeenCalled();
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "summary-category-Characters")?.trailingLabel,
	).toBe("Loading...");
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).toContain("summary-category-Quests");
	expect(
		lists
			.get("achievements-list")
			?.rows.some((r) => r.label === "Loading completion categories..."),
	).toBe(false);
	expect(frames.get("achievements-loading-track")?.visible).toBe(true);
	expect(frames.get("achievements")?.labels.get("loading")).toBe(
		"Loading achievements...",
	);
	flush();
	expect(frames.get("achievements-loading-track")?.visible).toBe(false);
	expect(frames.get("achievements")?.labels.get("loading")).toBe("");
});
it("publishes one summary button when native roots share a curated page name", () => {
	const { client, step, panel } = setup(false);
	vi.spyOn(client, "categories").mockReturnValue([
		{ id: 15246, name: "Expansion Features", parent: -1 },
		{ id: 900000, name: "Expansion Features", parent: -1 },
	]);
	step();
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => node.navId === "summary-category-Expansion Features"),
	).toHaveLength(1);
});
it("updates completion counts within a category before the category finishes loading", () => {
	const { client, step } = setup(false);
	let partial:
		| ((completed: number, total: number, rows: readonly Achievement[]) => void)
		| undefined;
	vi.mocked(client.loadCategory).mockImplementation(
		(_id, _complete, progress) => {
			partial = progress;
			return vi.fn();
		},
	);
	step();
	step();
	partial?.(1, 100, [achievement(6, true), achievement(7)]);
	expect(
		lists
			.get("achievements-list")
			?.rows.find((row) => row.id === "summary-category-Characters")
			?.trailingLabel,
	).toBe("1/2 50%");
	partial?.(2, 100, [achievement(8)]);
	expect(
		lists
			.get("achievements-list")
			?.rows.find((row) => row.id === "summary-category-Characters")
			?.trailingLabel,
	).toBe("1/3 33%");
});
it("fills summary button counts as categories arrive while later scans remain pending", () => {
	const { panel, client, step } = setup(false);
	step();
	step();
	step();
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "summary-category-Characters")?.trailingLabel,
	).toBe("1/2 50%");
	expect(client.achievements).toHaveBeenCalledOnce();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "summary-category-Quests"),
	).toBe(true);
});

it("yields between cached categories so loading progress is visible before completion", () => {
	const { client, step, flush } = setup(false);
	vi.mocked(client.loadCategory).mockImplementation((id, complete) => {
		complete(client.achievements(id, false));
		return vi.fn();
	});
	step();
	step();
	expect(client.loadCategory).toHaveBeenCalledTimes(1);
	expect(frames.get("achievements-loading-track")?.visible).toBe(true);
	expect(
		frames.get("achievements-loading-progress")?.layouts.at(-1)?.at(0),
	).toBeCloseTo(140 / 6);
	expect(
		lists
			.get("achievements-list")
			?.rows.find((row) => row.id === "summary-category-Characters")?.progress
			?.value,
	).toBe(0.5);
	flush();
});

it("opens an already loaded category while unrelated categories are still scanning", () => {
	const { panel, client, step, flush } = setup(false);
	vi.mocked(client.loadCategory).mockImplementation((id, complete) => {
		if (id === 92) complete([achievement(6, true), achievement(7)]);
		return vi.fn();
	});
	step();
	step();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "summary-category-Characters")
		?.onInteract();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toContain("achievement-6");
	expect(frames.get("achievements-loading-track")?.visible).toBe(true);
});

it("opens published partial rows and adds the remaining rows when that category completes", () => {
	const { panel, client, step, flush } = setup(false);
	let complete: ((rows: Achievement[]) => void) | undefined;
	let progress:
		| ((completed: number, total: number, rows: readonly Achievement[]) => void)
		| undefined;
	vi.mocked(client.loadCategory).mockImplementation((id, done, partial) => {
		if (id === 92) {
			complete = done;
			progress = partial;
		}
		return vi.fn();
	});
	step();
	step();
	progress?.(1, 2, [achievement(6, true)]);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "summary-category-Characters")
		?.onInteract();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toContain("achievement-6");
	complete?.([achievement(6, true), achievement(7)]);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toContain("achievement-7");
});

it("keeps a focused achievement visible and navigable when the cold scan completes", () => {
	const { panel, client, step, flush } = setup(false);
	let complete: ((rows: Achievement[]) => void) | undefined;
	vi.mocked(client.loadCategory).mockImplementation((id, done) => {
		if (id === 92) complete = done;
		else done([]);
		return vi.fn();
	});
	step();
	step();
	const rows = Array.from({ length: 80 }, (_, index) =>
		achievement(900100 + index),
	);
	complete?.(rows);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "summary-category-Characters")
		?.onInteract();
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	nav.registerGrid("achievements", () => panel.getNavGrid());
	nav.setActiveGrid("achievements");
	panel.setNavigationChanged((id) => nav.refreshGrid("achievements", id));
	// Render the early page before allowing the remaining scan to complete.
	step();
	step();
	events.emit("NAV_DOWN");
	expect(nav.focusedId).toBe("achievement-900100");
	for (let index = 0; index < 20; index++) {
		step();
		expect(nav.focusedId).toBe("achievement-900100");
		expect(frames.get("achievements-icon-0")?.visible).toBe(true);
		expect(
			panel
				.getNavGrid()
				.flat()
				.find((node) => node.navId === "achievement-900100")
				?.tooltipItem?.(),
		).toBeDefined();
	}
	flush();
	nav.destroy();
});

it("keeps publishing category counts when an event restarts the initial scan", () => {
	const { panel, step } = setup(false);
	step();
	panel.refresh();
	step();
	step();
	step();
	step();
	expect(
		lists
			.get("achievements-list")
			?.rows.find((row) => row.id === "summary-category-Characters")
			?.trailingLabel,
	).toBe("1/2 50%");
	expect(
		lists
			.get("achievements-list")
			?.rows.find((row) => row.id === "summary-category-Quests")?.trailingLabel,
	).toBe("Loading...");
});

it("keeps an early achievement usable through cache invalidations and defers replacement until reopening", () => {
	const { panel, client, step, flush } = setup(false);
	let complete: ((rows: Achievement[]) => void) | undefined;
	vi.mocked(client.loadCategory).mockImplementation((id, done, partial) => {
		if (id === 92) {
			complete = done;
			partial?.(1, 2, [achievement(6)]);
		} else done([]);
		return vi.fn();
	});
	step();
	step();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "summary-category-Characters")
		?.onInteract();
	flush();
	edges.mockClear();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "achievement-6")
		?.navigationScroll?.scrollToEdge("down");
	expect(edges).not.toHaveBeenCalled();
	for (let event = 0; event < 5; event++) panel.invalidate();
	expect(client.loadCategory).toHaveBeenCalledOnce();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "achievement-6")
			?.tooltipItem?.(),
	).toBeDefined();
	complete?.([achievement(6), achievement(7)]);
	flush();
	expect(
		vi.mocked(client.loadCategory).mock.calls.filter(([id]) => id === 92),
	).toHaveLength(1);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "achievement-7"),
	).toBe(true);
	panel.destroy();
});
it("reuses the complete category grid and its controls on an unchanged reopen", () => {
	const { panel, parent, activate, flush } = setup();
	activate("summary-category-Quests");
	const node = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievement-503");
	panel.onUnmount();
	panel.onMount(parent);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((n) => n.navId === "achievement-503"),
	).toBe(node);
});
it("budgets retained control cleanup instead of hiding the entire grid during an interaction", () => {
	const { panel, client, activate, flush, step } = setup();
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92
			? Array.from({ length: 100 }, (_, i) => achievement(900800 + i))
			: [],
	);
	panel.refresh();
	flush();
	activate("summary-category-Characters");
	const hide = vi.spyOn(Frame.prototype, "hide");
	panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievements-filter")
		?.onInteract();
	expect(hide.mock.calls.length).toBeLessThan(20);
	hide.mockClear();
	step();
	expect(hide.mock.calls.length).toBeLessThanOrEqual(72);
	hide.mockRestore();
	flush();
});
it("keeps the corner loading bar visible until deferred grid rendering finishes", () => {
	const { panel, flush } = setup();
	panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "summary-category-Quests")
		?.onInteract();
	expect(frames.get("achievements-loading-track")?.visible).toBe(true);
	expect(frames.get("achievements")?.labels.get("loading")).toBe(
		"Loading achievements...",
	);
	flush();
	expect(frames.get("achievements-loading-track")?.visible).toBe(false);
});
it("keeps stable category button identities with native summary totals", () => {
	const { panel, client, step } = setup(false);
	vi.mocked(client.summary).mockReturnValue({
		points: 100,
		totals: { total: 20, completed: 5 },
		recent: [],
		categories: [
			{ id: 92, name: "General", parent: -1, total: 2, completed: 1 },
		],
	});
	step();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((n) => n.navId),
	).toContain("summary-category-Characters");
});
it("loads a requested category ahead of unrelated categories and renders it before the entire catalog", () => {
	const { panel, client, step } = setup(false);
	vi.spyOn(client, "categories").mockReturnValue([
		{ id: 92, name: "General", parent: -1 },
		{ id: 1000, name: "Future", parent: -1 },
		{ id: 96, name: "Quests", parent: -1 },
		{ id: 99, name: "Northrend", parent: 96 },
	]);
	step();
	step(); // start the first category
	const button = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "summary-category-Quests");
	button?.onInteract();
	for (
		let i = 0;
		i < 8 && vi.mocked(client.loadCategory).mock.calls.length < 2;
		i++
	)
		step();
	expect(vi.mocked(client.loadCategory).mock.calls.at(1)?.at(0)).toBe(96);
	for (
		let i = 0;
		i < 8 &&
		!panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "achievement-503");
		i++
	)
		step();
	expect(
		vi.mocked(client.achievements).mock.calls.some(([id]) => id === 1000),
	).toBe(false);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((n) => n.navId === "achievement-503"),
	).toBe(true);
});
it("opens a two-column reputation-style summary with progress buttons and drills into category grids", () => {
	const { panel, activate } = setup();
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "summary-category-Characters"),
	).toMatchObject({
		label: "Characters",
		icon: "Interface\\Icons\\Achievement_Level_10",
		iconSize: 20,
		progress: { value: 0.5 },
	});
	expect(
		panel
			.getNavGrid()
			.at(0)
			?.map((n) => n.navId),
	).toEqual(["summary-category-Characters", "summary-category-Quests"]);
	expect(
		lists
			.get("achievements-list")
			?.rows.find((r) => r.id === "summary-category-Quests")?.backgroundAtlas,
	).toBe("ui-journeys-renown-button");
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
it("selects clicked achievements in the grid with their tooltip; Back returns to summary", () => {
	const { panel, client, activate, close, flush } = setup();
	activate("summary-category-Quests");
	const changed = vi.fn();
	const nav = new NavigationManager(createTestEventBus(), undefined, changed);
	panel.setNavigationChanged((focusId) => nav.refreshGrid("left", focusId));
	nav.registerGrid("left", () => panel.getNavGrid());
	nav.setActiveGrid("left");
	expect(client.criteria).not.toHaveBeenCalled();
	const tooltip = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievement-503")
		?.tooltipItem?.();
	expect(tooltip).toMatchObject({
		text: expect.stringContaining("Explore the world"),
	});
	frames.get("achievements-icon-1")?.click?.();
	flush();
	expect(nav.focusedId).toBe("achievement-503");
	expect(changed.mock.lastCall?.at(0)?.tooltipItem?.()).toEqual(tooltip);
	nav.interact();
	expect(nav.focusedId).toBe("achievement-503");
	expect(client.criteria).not.toHaveBeenCalled();
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

it("refreshes only the retained records in the opened curated page", () => {
	const { client, activate } = setup();
	const lookup = vi.spyOn(client, "achievement");
	activate("summary-category-Characters");
	expect(lookup.mock.calls.map((call) => call.at(0))).toEqual([6, 7]);
	expect(client.loadCategory).toHaveBeenCalledTimes(3);
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
	expect(grid.map((row) => row.length)).toEqual([5, 5, 2]);
	expect(grid.at(0)?.map((n) => n.navColumn)).toEqual([0, 1, 2, 3, 4]);
	for (const state of frames.values())
		for (const [width, , x] of state.layouts)
			expect((width ?? 0) + (x ?? 0)).toBeLessThanOrEqual(500);
	grid.at(-1)?.at(-1)?.onFocus();
	const manager = new NavigationManager(createTestEventBus());
	manager.registerGrid("achievements", grid);
	manager.setActiveGrid("achievements");
	manager.moveUp();
	expect(edges).toHaveBeenLastCalledWith("up");
	manager.moveDown();
	manager.moveDown();
	manager.moveDown();
	expect(edges).toHaveBeenLastCalledWith("down");
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
	expect(client.criteria).not.toHaveBeenCalled();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((n) => n.navId === "achievement-503")
			?.tooltipItem?.(),
	).toMatchObject({ text: expect.stringContaining("503") });
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
it("external selection focuses its grid cell without a details page", () => {
	const { panel, client, flush } = setup();
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	vi.spyOn(client, "selection").mockReturnValue(7);
	panel.selectAchievement(7);
	flush();
	expect(changed).toHaveBeenCalledWith("achievement-7");
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "achievement-7"),
	).toBe(true);
	expect(client.criteria).not.toHaveBeenCalled();
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
	).toEqual([2, 2, 2, 2, 2, 2]);
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
it("pairs five-wide achievement grids and aligns navigation across unequal group heights", () => {
	const { panel, client, flush, activate } = setup();
	const ids = [
		6, 7, 8, 14782, 14783, 15805, 1176, 1177, 1178, 1180, 1181, 5455, 5456,
		6753, 889, 890, 5180,
	];
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92 ? ids.map((id) => achievement(id)) : [],
	);
	panel.refresh();
	flush();
	activate("summary-category-Characters");
	const rows = panel.getNavGrid().slice(1);
	expect(rows.map((row) => row.length)).toEqual([10, 4, 3]);
	expect(rows.at(1)?.map((n) => n.navColumn)).toEqual([0, 5, 6, 7]);
	const left = frames.get("achievements-border-0")?.layouts.at(-1);
	const right = frames.get("achievements-border-6")?.layouts.at(-1);
	expect(left?.at(2)).toBe(0);
	expect(right?.at(2)).toBe(242);
	expect(left?.at(3)).toBe(right?.at(3));
	expect(
		frames.get("achievements-border-14")?.layouts.at(-1)?.at(3),
	).toBeLessThan(right?.at(3) ?? 0);
});
it("packs achievement groups into the shorter column without adding a row gap", () => {
	const { panel, client, flush, activate } = setup();
	const ids = [
		6, 7, 8, 9, 14782, 14783, 15805, 19459, 7382, 7383, 7384, 7380, 1176, 889,
		545,
	];
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92 ? ids.map((id) => achievement(id)) : [],
	);
	panel.refresh();
	flush();
	const luaFilter = vi
		.spyOn(Array.prototype, "filter")
		.mockImplementation(function <T>(
			this: T[],
			predicate: (value: T, index: number, array: T[]) => unknown,
			thisArg?: unknown,
		) {
			const result: T[] = [];
			for (let index = 0; index < this.length; index++) {
				const value = this[index] as T;
				if (predicate.call(thisArg, value, index, this)) result.push(value);
			}
			return result;
		});
	try {
		activate("summary-category-Characters");
	} finally {
		luaFilter.mockRestore();
	}

	expect(frames.get("achievements-header-3")?.layouts.at(-1)).toEqual([
		226, 56, 242, -170,
	]);
	expect(frames.get("achievements-border-13")?.layouts.at(-1)).toEqual([
		42, 42, 242, -226,
	]);
	const mount = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "achievement-889");
	expect(mount?.navColumn).toBe(5);
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
	expect(icon?.tooltipItem?.()).toMatchObject({
		text: expect.stringContaining("Explore the world"),
	});
	icon?.onInteract();
	expect(client.criteria).not.toHaveBeenCalled();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "achievement-503"),
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
it("formats section percentages and large numbers and puts category counts on line two", () => {
	const { panel, client, flush, activate } = setup();
	vi.mocked(client.summary).mockReturnValue({
		points: 1234567,
		totals: { completed: 1000, total: 3000 },
		recent: [],
		categories: [],
	});
	vi.mocked(client.achievements).mockImplementation((id) =>
		id === 92
			? [achievement(6, true), achievement(7, true), achievement(8)]
			: [],
	);
	panel.refresh();
	flush();
	expect(frames.get("achievements")?.labels.get("overall")).toBe(
		"1,234,567 points",
	);
	const category = lists
		.get("achievements-list")
		?.rows.find((r) => r.id === "summary-category-Characters");
	expect(category).toMatchObject({
		trailingLabel: "2/3 67%",
		trailingOnSecondLine: true,
		height: 80,
	});
	expect(category?.detail).toBeUndefined();
	activate("summary-category-Characters");
	expect(frames.get("achievements-header-0")?.labels.get("count")).toBe(
		"2 / 3 • 67%",
	);
	expect(frames.get("achievements-header-1")?.labels.get("count")).toBe(
		"2 / 3 • 67%",
	);
	const tooltip = panel
		.getNavGrid()
		.flat()
		.find((n) => n.navId === "achievement-6")
		?.tooltipItem?.();
	expect(tooltip).toMatchObject({ anchor: { id: "achievements" } });
});
