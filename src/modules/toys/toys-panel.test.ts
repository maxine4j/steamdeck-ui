import { afterEach, expect, it, vi } from "vitest";
import type { IToysClient, Toy } from "../../clients/toys-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { ToysPanel } from "./toys-panel";

afterEach(() => vi.restoreAllMocks());
const toy = (id: number, expansionId = 10, favourite = false): Toy => ({
	id,
	name: `Toy ${id}`,
	icon: id,
	collected: true,
	favourite,
	expansionId,
});

function setup() {
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
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
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
	const client: IToysClient = {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
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

it("closes the native journal only when the host closes, rather than during panel switches", () => {
	const { panel, parent, publish, close } = setup();
	panel.onMount(parent);
	publish([toy(1)]);
	panel.onUnmount();
	expect(close).not.toHaveBeenCalled();
	panel.onContainerClosed();
	expect(close).toHaveBeenCalledOnce();
});

it("clears the focused secure target before asynchronous refresh reuses its icon", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([toy(1)]);
	const focused = panel.getNavGrid().at(0)?.at(0);
	expect(focused?.secureActions?.().alternate).toBeDefined();
	const changed = vi.fn(() =>
		expect(focused?.secureActions?.().alternate).toBeUndefined(),
	);
	panel.setNavigationChanged(changed);
	panel.refresh();
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
	expect(client.load).toHaveBeenCalledTimes(1);
	panel.refreshCooldowns();
	expect(client.load).toHaveBeenCalledTimes(1);
	expect(client.getCooldown).toHaveBeenCalledWith(3);
	panel.refresh();
	publish([toy(2, 11)]);
	expect(vi.mocked(Frame.prototype.setIcon).mock.contexts.at(-1)).toBe(
		icons.at(0),
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
	expect(panel.getNavGrid()).toEqual([]);
	pending.shift()?.();
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

it("invalidates a partial grid before replacing its controls", () => {
	const { panel, parent, client, menu, pending, publish } = setup();
	panel.onMount(parent);
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		Array.from({ length: 25 }, (_, index) => toy(index + 1)),
	);
	pending.shift()?.();
	const first = panel.getNavGrid().at(0)?.at(0);
	expect(first?.secureActions?.().alternate).toBeDefined();
	panel.refresh();
	expect(panel.getNavGrid()).toEqual([]);
	expect(first?.secureActions?.().alternate).toBeUndefined();
	expect(first?.tooltipItem?.()).toBeUndefined();
	first?.onContext?.();
	expect(menu.open).not.toHaveBeenCalled();
	publish([toy(99)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-99"]);
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
	pending.shift()?.();
	expect(widths().at(-1)).toBeCloseTo(70 + 70 * (10 / 26));
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
	pending.shift()?.();
	expect(changed).toHaveBeenCalledOnce();
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
