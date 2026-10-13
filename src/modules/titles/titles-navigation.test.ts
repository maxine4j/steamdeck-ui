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
		onClick = vi.fn();
		inset = vi.fn();
		fill = vi.fn();
		setWindowBackground = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		revealVerticalRange = vi.fn();
	},
}));

it("keeps the selected title's grid position and focus throughout scheduled updates", () => {
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
	let selected = 1;
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
	panel.setNavigationChanged(() => nav.refreshGrid("titles"));
	panel.onMount(new Frame("parent", pool));
	flush();
	nav.registerGrid("titles", () => panel.getNavGrid());
	nav.setActiveGrid("titles");
	for (let row = 0; row < 8; row++) nav.moveDown();
	nav.moveRight();
	expect(nav.focusedId).toBe("title-18");
	const focused = panel.getNavGrid().at(8)?.at(1);
	focused?.onInteract();
	expect(selected).toBe(18);
	while (pending.length) {
		pending.shift()?.();
		expect(nav.focusedId).toBe("title-18");
		expect(panel.getNavGrid().at(8)?.at(1)).toBe(focused);
	}
	nav.moveDown();
	expect(nav.focusedId).toBe("title-20");
});
