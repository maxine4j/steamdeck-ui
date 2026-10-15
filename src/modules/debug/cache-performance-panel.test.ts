import { expect, it, vi } from "vitest";
import { Diagnostics } from "../../clients/diagnostics";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { CachePerformancePanel } from "./cache-performance-panel";

const { frames } = vi.hoisted(() => ({
	frames: new Map<string, Frame>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(id: string) {
			frames.set(id, this as unknown as Frame);
		}
		fill = vi.fn();
		inset = vi.fn();
		layout = vi.fn();
		setParent = vi.fn();
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setLabelWordWrap = vi.fn();
		setScrollContent = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		clampScroll = vi.fn();
		setFocused = vi.fn();
		setNavigationFocus = vi.fn();
		setColor = vi.fn();
		setOpacity = vi.fn();
		setButtonBackground = vi.fn();
		setTooltip = vi.fn();
		hideTooltip = vi.fn();
		onClick = vi.fn();
		revealVerticalRange = vi.fn();
	},
}));

it("updates live performance cards without reanchoring the viewport or revealing the focused row", () => {
	const pool = {} as IFramePoolManager;
	const diagnostics = new Diagnostics(() => 120);
	const job = {
		id: 1,
		label: "Scan",
		reason: "login",
		completed: 1,
		total: 2,
		elapsed: 5,
		state: "running",
	};
	diagnostics.work(job);
	let entries = 20;
	const pending: (() => void)[] = [];
	const panel = new CachePerformancePanel(
		pool,
		diagnostics,
		() => [{ namespace: "mounts", entries, pending: 0, updatedAt: 100 }],
		{
			delay: (_seconds, callback) => {
				pending.push(callback);
				return vi.fn();
			},
		},
		vi.fn(),
	);
	const navigation = new NavigationManager(createTestEventBus());
	panel.onMount(new Frame("parent", pool));
	navigation.registerGrid("debug", () => panel.getNavGrid());
	navigation.setActiveGrid("debug");
	panel.setNavigationChanged(() => navigation.refreshGrid("debug"));
	const content = frames.get("debug-cache-list-content");
	const scroll = frames.get("debug-cache-list-scroll");
	expect(content).toBeDefined();
	expect(scroll).toBeDefined();
	vi.mocked(content?.layout).mockClear();
	vi.mocked(scroll?.revealVerticalRange).mockClear();
	entries = 21;
	diagnostics.work({ ...job, completed: 2 });
	pending.shift()?.();
	expect(content?.layout).not.toHaveBeenCalled();
	expect(scroll?.revealVerticalRange).not.toHaveBeenCalled();
	expect(navigation.focusedId).toBe("cache-mounts");
	expect(frames.get("debug-cache-list-row-1")?.setLabel).toHaveBeenCalledWith(
		"label",
		"mounts: 21 records",
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
	);
	expect(frames.get("debug-cache-list-row-3")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Scan · running · 2/2",
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
		expect.anything(),
	);
	panel.onUnmount();
});

it("uses neutral cards for cache and work records, including after controller focus", () => {
	const pool = {} as IFramePoolManager;
	const diagnostics = new Diagnostics(() => 120);
	diagnostics.work({
		id: 1,
		label: "Scan",
		reason: "login",
		completed: 1,
		total: 2,
		elapsed: 5,
		state: "running",
	});
	const panel = new CachePerformancePanel(
		pool,
		diagnostics,
		() => [{ namespace: "mounts", entries: 20, pending: 0, updatedAt: 100 }],
		{ delay: () => vi.fn() },
		vi.fn(),
	);
	panel.onMount(new Frame("parent", pool));
	for (const index of [1, 3]) {
		const card = frames.get(`debug-cache-list-row-${index}`);
		expect(card?.setButtonBackground).not.toHaveBeenCalled();
		expect(card?.setColor).toHaveBeenLastCalledWith(0.08, 0.09, 0.11);
	}
	panel.getNavGrid().at(0)?.at(0)?.onFocus();
	expect(
		frames.get("debug-cache-list-row-1")?.setButtonBackground,
	).not.toHaveBeenCalled();
	panel.onUnmount();
});
