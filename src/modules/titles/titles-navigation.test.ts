import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { TitlesPanel } from "./titles-panel";

vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		layout = vi.fn();
		setParent = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		setLabel = vi.fn();
		setLabelWordWrap = vi.fn();
		setColor = vi.fn();
		setFocused = vi.fn();
		setIcon = vi.fn();
		setTooltip = vi.fn();
		hideTooltip = vi.fn();
		onClick = vi.fn();
		inset = vi.fn();
		fill = vi.fn();
		setWindowBackground = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		revealVerticalRange = vi.fn();
	},
}));

it("defaults to the selected title on opening, selection and external updates", () => {
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			let cancelled = false;
			pending.push(() => {
				if (!cancelled) callback();
			});
			return () => {
				cancelled = true;
			};
		},
	};
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	let selected = 18;
	const client = {
		getTitles: () =>
			Array.from({ length: 24 }, (_, index) => ({
				id: index + 1,
				name: `Title ${index + 1}`,
				selected: selected === index + 1,
			})),
		select: (id: number) => {
			selected = id;
		},
	};
	const pool = {} as IFramePoolManager;
	const panel = new TitlesPanel(pool, client, vi.fn(), scheduler);
	const nav = new NavigationManager(createTestEventBus());
	panel.setNavigationChanged((focusId) => nav.refreshGrid("titles", focusId));
	panel.onMount(new Frame("parent", pool));
	nav.registerGrid("titles", () => panel.getNavGrid());
	nav.setActiveGrid("titles");
	flush();
	expect(nav.focusedId).toBe("title-18");
	nav.moveDown();
	const focused = panel.getNavGrid().at(9)?.at(1);
	focused?.onInteract();
	expect(selected).toBe(20);
	while (pending.length) {
		pending.shift()?.();
		expect(nav.focusedId).toBe("title-20");
		expect(panel.getNavGrid().at(9)?.at(1)).toBe(focused);
	}
	nav.moveDown();
	expect(nav.focusedId).toBe("title-22");
	panel.onUnmount();
	panel.onMount(new Frame("parent", pool));
	flush();
	expect(nav.focusedId).toBe("title-20");
	selected = 3;
	panel.refresh();
	flush();
	expect(nav.focusedId).toBe("title-3");
});
