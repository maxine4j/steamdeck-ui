import { afterEach, expect, it, vi } from "vitest";
import type { IToysClient, Toy } from "../../clients/toys-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { Dropdown } from "../../ui/components/dropdown";
import { Frame } from "../../ui/components/frame";
import { SearchFilters } from "../../ui/components/search-filters";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import * as toyDisplay from "./toy-display";
import { ToysPanel } from "./toys-panel";

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});
it("shows controller graphics beside toy action descriptions", () => {
	const { panel, parent } = setup();
	panel.onMount(parent);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"actions",
		expect.stringContaining("xbox_r_x.blp:18:18|t Use"),
		"BOTTOMLEFT",
		16,
		16,
		12,
	);
});
it("keeps a warm toy view and its actions unchanged until reopening after invalidation", () => {
	const { panel, parent, client, menu, publish, flush } = setup();
	panel.onMount(parent);
	publish([toy(1)]);
	const first = panel.getNavGrid().at(0)?.at(0);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	for (let event = 0; event < 5; event++) publish([toy(1)]);
	panel.resume();
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	expect(Frame.prototype.setIcon).not.toHaveBeenCalled();
	expect(panel.getNavGrid().at(0)?.at(0)).toBe(first);
	expect(first?.secureActions?.().alternate).toBeDefined();
	first?.onContext?.();
	expect(menu.open).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([toy(1), toy(2)]);
	expect(panel.getNavGrid().flat()).toHaveLength(2);
	panel.destroy();
});
it("keeps early toys usable through item-data invalidations and defers replacement until reopening", () => {
	const { panel, parent, client, menu, flush, publish } = setup();
	panel.onMount(parent);
	const load = vi.mocked(client.load).mock.calls.at(-1);
	load?.at(0)?.([toy(1)], false);
	flush();
	panel.getNavGrid().at(0)?.at(0)?.navigationScroll?.scrollToEdge("down");
	expect(Frame.prototype.scrollToEdge).not.toHaveBeenCalled();
	for (let event = 0; event < 5; event++) publish([toy(1)]);
	expect(client.load).toHaveBeenCalledOnce();
	const first = panel.getNavGrid().at(0)?.at(0);
	expect(first?.secureActions?.().alternate).toBeDefined();
	first?.onContext?.();
	expect(menu.open).toHaveBeenCalledExactlyOnceWith(toy(1));
	load?.at(0)?.([toy(1), toy(2)]);
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	panel.destroy();
});
it("shows Blizzard's favourite star and clears it when a cell is reused", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([toy(1, 10, true)]);
	expect(Frame.prototype.setAtlasBackground).toHaveBeenCalledWith(
		"collections-icon-favorites",
	);
	const star = vi
		.mocked(Frame.prototype.setAtlasBackground)
		.mock.contexts.at(0);
	expect(vi.mocked(Frame.prototype.show).mock.contexts).toContain(star);
	const colors = vi.mocked(Frame.prototype.setColor);
	expect(
		colors.mock.calls.filter((_, index) =>
			colors.mock.contexts.at(index)?.id.startsWith("toys-border-"),
		),
	).toEqual([
		[0.3, 0.34, 0.42],
		[0.3, 0.34, 0.42],
	]);
	panel.refresh();
	vi.mocked(Frame.prototype.hide).mockClear();
	publish([toy(1)]);
	expect(vi.mocked(Frame.prototype.hide).mock.contexts).toContain(star);
	panel.destroy();
	expect(vi.mocked(Frame.prototype.destroy).mock.contexts).not.toContain(star);
});
const toy = (id: number, expansionId = 10, favourite = false): Toy => ({
	id,
	name: `Toy ${id}`,
	icon: id,
	collected: true,
	favourite,
	expansionId,
});

function setup() {
	vi.spyOn(SearchFilters.prototype, "mount").mockImplementation(() => {});
	vi.spyOn(SearchFilters.prototype, "setOptions").mockImplementation(() => {});
	vi.spyOn(SearchFilters.prototype, "hide").mockImplementation(() => {});
	vi.spyOn(SearchFilters.prototype, "destroy").mockImplementation(() => {});
	for (const method of [
		"fill",
		"setWindowBackground",
		"setButtonBackground",
		"setInsetBackground",
		"setCloseButtonBackground",
		"setParent",
		"layout",
		"setColor",
		"inset",
		"onSizeChanged",
		"setScrollContent",
		"clampScroll",
		"setIcon",
		"setAtlasBackground",
		"setOpacity",
		"setToy",
		"setHoverTooltip",
		"setCooldown",
		"setLabel",
		"show",
		"hide",
		"setFocused",
		"destroy",
		"revealVerticalRange",
		"scrollToEdge",
		"configureInput",
		"focusInput",
		"blurInput",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const pending: (() => void)[] = [];
	const scheduler = {
		delay: (seconds: number, callback: () => void) => {
			const timer = setTimeout(callback, seconds * 1000);
			return () => clearTimeout(timer);
		},
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
	const client: IToysClient = {
		search: vi.fn(),
		getFilters: vi.fn(() => []),
		toggleFilter: vi.fn(),
		prefetch: vi.fn(),
		refreshEntry: vi.fn(),
		refreshItem: vi.fn(() => false),
		stop: vi.fn(),
		isInCombat: vi.fn(() => false),
		load: vi.fn(() => vi.fn()),
		canUse: vi.fn(() => true),
		toggleFavourite: vi.fn(),
		getCooldown: vi.fn(() => ({ start: 10, duration: 60 })),
	};
	const menu = { open: vi.fn(), close: vi.fn() };
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	const panel = new ToysPanel(pool, client, menu, scheduler, close);
	const parent = new Frame("parent", pool);
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	const publish = (toys: Toy[]) => {
		vi.mocked(client.load).mock.calls.at(-1)?.[0](toys);
		flush();
	};
	return { panel, parent, client, menu, flush, publish, pending, close };
}

it("searches toys and refreshes native checkbox filters through the header controls", () => {
	vi.useFakeTimers();
	const { panel, parent, client } = setup();
	vi.mocked(SearchFilters.prototype.mount).mockRestore();
	vi.spyOn(Dropdown.prototype, "mount").mockImplementation(() => {});
	vi.mocked(client.getFilters).mockReturnValue([
		{ id: "usable", label: "Usable only", checked: false },
	]);
	panel.onMount(parent);
	const search = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "toys-search");
	expect(search).toBeDefined();
	search?.onInteract();
	expect(Frame.prototype.focusInput).toHaveBeenCalled();
	vi.mocked(Frame.prototype.configureInput).mock.lastCall?.at(0)?.("train");
	expect(client.search).not.toHaveBeenCalled();
	vi.advanceTimersByTime(299);
	expect(client.search).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(client.search).toHaveBeenCalledWith("train");
	expect(client.load).toHaveBeenCalledTimes(2);
	const option = vi
		.mocked(SearchFilters.prototype.setOptions)
		.mock.lastCall?.at(0)
		.at(0);
	expect(option).toMatchObject({
		id: "usable",
		label: "Usable only",
		checked: false,
	});
	option?.activate();
	expect(client.toggleFilter).toHaveBeenCalledWith("usable");
	expect(client.load).toHaveBeenCalledTimes(3);
	expect(Frame.prototype.inset).toHaveBeenCalledWith(
		expect.any(Frame),
		16,
		104,
		16,
		48,
	);
});

it("closes the native journal only when the host closes, rather than during panel switches", () => {
	const { panel, parent, publish, close } = setup();
	panel.onMount(parent);
	publish([toy(1)]);
	panel.onUnmount();
	expect(close).not.toHaveBeenCalled();
	panel.onContainerClosed();
	expect(close).toHaveBeenCalledOnce();
});

it("clears the focused secure target when the cache removes its entry", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([toy(1)]);
	const focused = panel.getNavGrid().at(0)?.at(0);
	expect(focused?.secureActions?.().alternate).toBeDefined();
	const changed = vi.fn(() =>
		expect(focused?.secureActions?.().alternate).toBeUndefined(),
	);
	panel.setNavigationChanged(changed);
	publish([]);
	expect(changed).toHaveBeenCalledOnce();
});

it("renders favourite and expansion grids with X use, Y tooltip actions and scrolling focus", () => {
	const { panel, parent, client, menu, publish } = setup();
	panel.onMount(parent);
	const favourite = toy(1, 0, true);
	publish([toy(3, 0), toy(2, 11), favourite]);
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toEqual([["toy-favourite-1"], ["toy-2"], ["toy-1", "toy-3"]]);
	const node = panel.getNavGrid().at(0)?.at(0);
	expect(node?.tooltipItem?.()).toEqual({ toy: 1 });
	const hover = vi
		.mocked(Frame.prototype.setHoverTooltip)
		.mock.calls.at(0)
		?.at(0);
	expect(hover?.()).toEqual({ toy: 1 });
	node?.onContext?.();
	expect(menu.open).toHaveBeenCalledExactlyOnceWith(favourite);
	node?.onFocus();
	expect(Frame.prototype.revealVerticalRange).toHaveBeenCalled();
	node?.navigationScroll?.scrollToEdge("up");
	expect(Frame.prototype.scrollToEdge).toHaveBeenLastCalledWith("up");
	const click = vi.spyOn(Frame.prototype, "click").mockImplementation(() => {});
	node?.onAlternate?.();
	expect(click).not.toHaveBeenCalled();
	expect(node?.secureActions?.().alternate?.id).toBe("toys-icon-0");
	vi.mocked(client.canUse).mockReturnValue(false);
	node?.onAlternate?.();
	expect(node?.secureActions?.().alternate).toBeUndefined();
	panel.onUnmount();
	expect(hover?.()).toBeUndefined();
	node?.onContext?.();
	node?.onAlternate?.();
	expect(menu.open).toHaveBeenCalledTimes(1);
	expect(node?.secureActions?.().alternate).toBeUndefined();
	expect(click).not.toHaveBeenCalled();
});

it("defers secure frame creation and rendering until combat ends", () => {
	const { panel, parent, client, publish, flush } = setup();
	vi.mocked(client.isInCombat).mockReturnValue(true);
	panel.onMount(parent);
	expect(client.load).not.toHaveBeenCalled();
	expect(Frame.prototype.fill).not.toHaveBeenCalled();
	vi.mocked(client.isInCombat).mockReturnValue(false);
	panel.resume();
	expect(client.load).toHaveBeenCalledOnce();
	vi.mocked(client.isInCombat).mockReturnValue(true);
	publish([toy(1)]);
	expect(Frame.prototype.setToy).not.toHaveBeenCalled();
	vi.mocked(client.isInCombat).mockReturnValue(false);
	panel.resume();
	publish([toy(1)]);
	flush();
	expect(Frame.prototype.setToy).toHaveBeenCalledWith(1);
});

it("shows collected and total counts including favourites in expansion headers", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([toy(1, 10, true), { ...toy(2, 10), collected: false }, toy(3, 0)]);
	const titles = vi
		.mocked(Frame.prototype.setLabel)
		.mock.calls.filter(([key]) => key === "title")
		.map(([, label]) => label);
	expect(titles).toEqual([
		"Favourites (1 / 1)",
		"The War Within (1 / 2)",
		"Classic (1 / 1)",
	]);
	panel.refresh();
	publish([toy(1, 10), toy(2, 10)]);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"title",
		"The War Within (2 / 2)",
		"LEFT",
		0,
		0,
		15,
		460,
	);
});

it("darkens uncollected borders and icons and restores collected styling on reuse", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([{ ...toy(1), collected: false }]);
	expect(Frame.prototype.setColor).toHaveBeenCalledWith(0.12, 0.12, 0.12);
	expect(Frame.prototype.setOpacity).toHaveBeenLastCalledWith(0.2);
	expect(Frame.prototype.setToy).toHaveBeenLastCalledWith(undefined);
	panel.refresh();
	publish([toy(1)]);
	expect(Frame.prototype.setColor).toHaveBeenLastCalledWith(0.3, 0.34, 0.42);
	expect(Frame.prototype.setOpacity).toHaveBeenLastCalledWith(1);
	expect(Frame.prototype.setToy).toHaveBeenLastCalledWith(1);
});

it("reuses icons on reopen, hides surplus groups and refreshes cooldowns without collection scans", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([toy(1, 0, true), toy(2, 11), toy(3, 0)]);
	const icons = vi.mocked(Frame.prototype.setIcon).mock.contexts.slice();
	panel.onUnmount();
	panel.onMount(parent);
	flush();
	expect(client.load).toHaveBeenCalledTimes(2);
	panel.refreshCooldowns();
	expect(client.load).toHaveBeenCalledTimes(2);
	expect(client.getCooldown).toHaveBeenCalledWith(3);
	panel.refresh();
	publish([toy(2, 11)]);
	expect(vi.mocked(Frame.prototype.setIcon).mock.contexts.at(-1)).toBe(
		icons.at(1),
	);
	expect(
		vi.mocked(Frame.prototype.hide).mock.contexts.map((frame) => frame.id),
	).toContain("toys-header-2");
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-2"]);
});

it("makes the first rendered batch interactive while remaining toys render", () => {
	const { panel, parent, client, menu, pending, flush } = setup();
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	panel.onMount(parent);
	changed.mockClear();
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		Array.from({ length: 25 }, (_, index) => toy(index + 1)),
	);
	const firstBatch = panel.getNavGrid().flat();
	expect(firstBatch).toHaveLength(9); // One header and nine icons per batch.
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(9);
	expect(changed).toHaveBeenCalledOnce();
	const first = firstBatch.at(0);
	expect(first?.tooltipItem?.()).toEqual({ toy: 1 });
	expect(first?.secureActions?.().alternate).toBeDefined();
	first?.onContext?.();
	expect(menu.open).toHaveBeenCalledWith(toy(1));
	vi.mocked(client.getCooldown).mockClear();
	panel.refreshCooldowns();
	expect(client.getCooldown).toHaveBeenCalledTimes(9);
	pending.shift()?.();
	expect(panel.getNavGrid().flat()).toHaveLength(19);
	expect(panel.getNavGrid().at(0)?.at(0)).toBe(first);
	flush();
	expect(panel.getNavGrid().map((row) => row.length)).toEqual([10, 10, 5]);
	expect(first?.secureActions?.().alternate).toBeDefined();
});

it("routes D-pad input through an early page while the cold journal scan is pending", () => {
	const { panel, parent, client, pending, flush, publish } = setup();
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	panel.onMount(parent);
	nav.registerGrid("toys", () => panel.getNavGrid());
	nav.setActiveGrid("toys");
	panel.setNavigationChanged(() => nav.refreshGrid("toys"));
	const preview = vi.mocked(client.load).mock.calls.at(-1)?.at(0);
	preview?.(
		Array.from({ length: 20 }, (_, index) => ({
			...toy(index + 1),
			name: `Toy ${String(index + 1).padStart(2, "0")}`,
		})),
		false,
	);
	pending.shift()?.();
	events.emit("NAV_RIGHT");
	expect(nav.focusedId).toBe("toy-2");
	expect(
		panel.getNavGrid().at(0)?.at(1)?.secureActions?.().alternate,
	).toBeDefined();
	flush();
	expect(Frame.prototype.setLabel).not.toHaveBeenCalledWith(
		"loading",
		"",
		"BOTTOMRIGHT",
		-16,
		16,
		12,
	);
	panel.onUnmount();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([toy(99)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-99"]);
	nav.destroy();
	panel.destroy();
});

it("retains partial navigation while waiting for replacement data and disables stale actions", () => {
	const { panel, parent, client, menu, publish } = setup();
	panel.onMount(parent);
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		Array.from({ length: 25 }, (_, index) => toy(index + 1)),
	);
	const first = panel.getNavGrid().at(0)?.at(0);
	expect(first?.secureActions?.().alternate).toBeDefined();
	panel.refresh();
	expect(panel.getNavGrid().flat()).toHaveLength(9);
	expect(first?.secureActions?.().alternate).toBeDefined();
	expect(first?.tooltipItem?.()).toEqual({ toy: 1 });
	first?.onContext?.();
	expect(menu.open).toHaveBeenCalledOnce();
	publish([toy(99)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-99"]);
});

it("routes D-pad input through cached toys while a background load is pending", () => {
	const { panel, parent, publish, client, pending, flush } = setup();
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	const toys = Array.from({ length: 25 }, (_, index) => ({
		...toy(index + 1),
		name: `Toy ${String(index + 1).padStart(2, "0")}`,
	}));
	panel.onMount(parent);
	publish(toys);
	nav.registerGrid("toys", () => panel.getNavGrid());
	nav.setActiveGrid("toys");
	panel.setNavigationChanged(() => nav.refreshGrid("toys"));
	events.emit("NAV_RIGHT");
	expect(nav.focusedId).toBe("toy-2");
	panel.refresh();
	events.emit("NAV_DOWN");
	expect(nav.focusedId).toBe("toy-12");
	events.emit("NAV_RIGHT");
	expect(nav.focusedId).toBe("toy-13");
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(toys);
	pending.shift()?.();
	events.emit("NAV_RIGHT");
	expect(nav.focusedId).toBe("toy-14");
	flush();
	events.emit("NAV_DOWN");
	expect(nav.focusedId).toBe("toy-24");
	nav.destroy();
	panel.destroy();
});

it("keeps focus on an early toy as a larger sorted snapshot renders", () => {
	const { panel, parent, client, pending, flush } = setup();
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	panel.onMount(parent);
	nav.registerGrid("toys", () => panel.getNavGrid());
	nav.setActiveGrid("toys");
	panel.setNavigationChanged(() => nav.refreshGrid("toys"));
	const toys = Array.from({ length: 40 }, (_, index) => ({
		...toy(index + 1),
		name: `Toy ${String(index + 1).padStart(2, "0")}`,
	}));
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(toys.slice(10, 30));
	flush();
	events.emit("NAV_DOWN");
	expect(nav.focusedId).toBe("toy-21");
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(toys);
	while (pending.length) {
		pending.shift()?.();
		expect(nav.focusedId).toBe("toy-21");
		expect(
			panel
				.getNavGrid()
				.flat()
				.find((node) => node.navId === "toy-21")
				?.secureActions?.().alternate,
		).toBeDefined();
	}
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "toy-21")
			?.secureActions?.().alternate,
	).toBeDefined();
	nav.destroy();
	panel.destroy();
});

it("cancels cached render continuations when fresher data arrives in the same load", () => {
	const { panel, parent, client, pending, flush } = setup();
	panel.onMount(parent);
	const publish = vi.mocked(client.load).mock.calls.at(-1)?.at(0);
	publish?.(Array.from({ length: 25 }, (_, index) => toy(index + 1)));
	pending.shift()?.();
	const stale = panel.getNavGrid().at(0)?.at(0);
	vi.mocked(Frame.prototype.setToy).mockClear();
	publish?.([toy(99)]);
	expect(stale?.secureActions?.().alternate).toBeUndefined();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-99"]);
	expect(Frame.prototype.setToy).toHaveBeenCalledExactlyOnceWith(99);
});

it("shows loading progress through scanning and rendering, then hides the bar", () => {
	const { panel, parent, client, pending, flush } = setup();
	const widths = () =>
		vi
			.mocked(Frame.prototype.layout)
			.mock.calls.filter(
				(_, index) =>
					vi.mocked(Frame.prototype.layout).mock.contexts.at(index)?.id ===
					"toys-loading-progress",
			)
			.map(([width]) => width);
	panel.onMount(parent);
	const progress = vi.mocked(client.load).mock.calls.at(-1)?.[1];
	progress?.(20, 40);
	expect(widths().at(-1)).toBe(35);
	progress?.(40, 40);
	expect(widths().at(-1)).toBe(70);
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		Array.from({ length: 25 }, (_, index) => toy(index + 1)),
	);
	expect(widths().at(-1)).toBeCloseTo(70 + 70 * (10 / 26));
	pending.shift()?.();
	expect(widths().at(-1)).toBeCloseTo(70 + 70 * (20 / 26));
	flush();
	expect(widths().at(-1)).toBe(140);
	expect(Frame.prototype.setLabel).toHaveBeenLastCalledWith(
		"loading",
		"",
		"BOTTOMRIGHT",
		-16,
		16,
		12,
	);
	expect(
		vi.mocked(Frame.prototype.hide).mock.contexts.map((frame) => frame.id),
	).toContain("toys-loading-track");
	panel.refresh();
	const before = widths().length;
	progress?.(40, 40);
	expect(widths()).toHaveLength(before);
	const latestProgress = vi.mocked(client.load).mock.calls.at(-1)?.[1];
	panel.onUnmount();
	latestProgress?.(20, 40);
	expect(widths()).toHaveLength(before);
});

it("rejects stale loads and cancels rendering on unmount, reloading interrupted work", () => {
	const { panel, parent, client, publish, pending, flush } = setup();
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	panel.onMount(parent);
	const old = vi.mocked(client.load).mock.calls.at(-1)?.[0];
	panel.refresh();
	changed.mockClear();
	old?.([toy(99)]);
	flush();
	expect(panel.getNavGrid()).toEqual([]);
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		Array.from({ length: 25 }, (_, index) => toy(index + 1)),
	);
	expect(changed).toHaveBeenCalledOnce();
	pending.shift()?.();
	expect(changed).toHaveBeenCalledTimes(2);
	panel.onUnmount();
	flush();
	expect(panel.getNavGrid()).toEqual([]);
	panel.onMount(parent);
	changed.mockClear();
	publish([toy(1)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-1"]);
	expect(changed).toHaveBeenCalledOnce();
});

it("renders cached toys immediately and updates only changed tiles from the live subscription", () => {
	const { panel, parent, client, flush } = setup();
	const first = toy(1);
	const second = toy(2);
	vi.mocked(client.load).mockImplementation((done) => {
		done([first, second], true);
		return () => {};
	});
	panel.onMount(parent);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "toy-1"),
	).toBe(true);
	flush();
	vi.mocked(Frame.prototype.setIcon).mockClear();
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(
		[first, { ...second, collected: false }],
		true,
	);
	flush();
	const icons = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("toys-icon-"));
	expect(icons.map((frame) => frame.id)).toEqual(["toys-icon-1"]);
});

it("merges incoming toy pages without cancelling or regrouping the current render", () => {
	const { panel, parent, client, pending, flush } = setup();
	const group = vi.spyOn(toyDisplay, "groupToys");
	panel.onMount(parent);
	const load = vi.mocked(client.load).mock.calls.at(-1);
	load?.at(0)?.(
		Array.from({ length: 25 }, (_, i) => toy(i + 1)),
		false,
	);
	const grouped = group.mock.calls.length;
	for (let i = 26; i <= 45; i++) load?.at(2)?.([toy(i)], false);
	expect(group).toHaveBeenCalledTimes(grouped);
	pending.shift()?.();
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(19);
	load?.at(2)?.([], true);
	flush();
	expect(panel.getNavGrid().flat()).toHaveLength(45);
});

it("restores secure actions when a toy disappears and returns during queued rendering", () => {
	const { panel, parent, client, flush } = setup();
	panel.onMount(parent);
	const load = vi.mocked(client.load).mock.calls.at(-1);
	load?.at(0)?.(
		Array.from({ length: 25 }, (_, i) => toy(i + 1)),
		false,
	);
	load?.at(2)?.([{ ...toy(1), displayed: false }], false);
	load?.at(2)?.([toy(1)], true);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "toy-1")
			?.secureActions?.().alternate,
	).toBeDefined();
});

it("refreshes the focused secure target immediately when a queued delta removes a ready toy", () => {
	const { panel, parent, client } = setup();
	panel.onMount(parent);
	const load = vi.mocked(client.load).mock.calls.at(-1);
	load?.at(0)?.(
		Array.from({ length: 25 }, (_, i) => toy(i + 1)),
		false,
	);
	const focused = panel.getNavGrid().at(0)?.at(0);
	const changed = vi.fn(() =>
		expect(focused?.secureActions?.().alternate).toBeUndefined(),
	);
	panel.setNavigationChanged(changed);
	load?.at(2)?.([{ ...toy(1), displayed: false }], false);
	expect(changed).toHaveBeenCalledOnce();
});

it("keeps cooldown updates associated with all retained controls during partial cache rendering", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	const toys = Array.from({ length: 45 }, (_, index) => toy(index + 1));
	publish(toys);
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(
		toys.map((entry, index) =>
			index < 20 ? { ...entry, collected: false } : entry,
		),
		true,
	);
	vi.mocked(client.getCooldown).mockClear();
	panel.refreshCooldowns();
	expect(client.getCooldown).toHaveBeenCalledTimes(20);
	flush();
	expect(
		new Set(vi.mocked(client.getCooldown).mock.calls.map((args) => args.at(0)))
			.size,
	).toBe(45);
});

it("bounds cooldown event bursts and refreshes retained cooldowns on an unchanged reopening", () => {
	const { panel, parent, client, publish, pending, flush } = setup();
	panel.onMount(parent);
	const toys = Array.from({ length: 45 }, (_, index) => toy(index + 1));
	publish(toys);
	vi.mocked(client.getCooldown).mockClear();
	for (let event = 0; event < 10; event++) panel.refreshCooldowns();
	expect(client.getCooldown.mock.calls.length).toBeLessThanOrEqual(20);
	pending.shift()?.();
	expect(client.getCooldown.mock.calls.length).toBeLessThanOrEqual(40);
	flush();
	panel.onUnmount();
	vi.mocked(client.load).mockImplementation((done) => {
		done(toys, true);
		return () => {};
	});
	vi.mocked(client.getCooldown).mockReturnValue({ start: 123, duration: 45 });
	panel.onMount(parent);
	flush();
	expect(Frame.prototype.setCooldown).toHaveBeenCalledWith(123, 45);
});

it("detaches on close, resubscribes on reopening, and retains toy frames for the session", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([toy(1), toy(2)]);
	const originals = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("toys-icon-"));
	const detach = vi.mocked(client.load).mock.results.at(0)?.value;
	panel.onUnmount();
	expect(detach).toHaveBeenCalledOnce();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([toy(3)]);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	publish([toy(1), toy(2)]);
	flush();
	const returned = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("toys-icon-"));
	expect(returned).toEqual(originals);
	panel.destroy();
	expect(Frame.prototype.destroy).not.toHaveBeenCalled();
	expect(SearchFilters.prototype.destroy).not.toHaveBeenCalled();
});
