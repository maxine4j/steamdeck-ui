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
		"setBlackBackground",
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
		vi.mocked(client.load).mock.calls.at(-1)?.at(0)(toys);
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
	node?.onContext?.();
	expect(menu.open).toHaveBeenCalledExactlyOnceWith(favourite);
	node?.onFocus();
	expect(Frame.prototype.revealVerticalRange).toHaveBeenCalled();
	const click = vi.spyOn(Frame.prototype, "click").mockImplementation(() => {});
	node?.onAlternate?.();
	expect(client.canUse).toHaveBeenCalledWith(1);
	expect(click).toHaveBeenCalledOnce();
	expect(click.mock.contexts.at(0)?.id).toBe("toys-icon-0");
	vi.mocked(client.canUse).mockReturnValue(false);
	node?.onAlternate?.();
	expect(click).toHaveBeenCalledTimes(1);
	panel.onUnmount();
	node?.onContext?.();
	node?.onAlternate?.();
	expect(menu.open).toHaveBeenCalledTimes(1);
	expect(click).toHaveBeenCalledTimes(1);
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

it("rejects stale loads and cancels rendering on unmount, reloading interrupted work", () => {
	const { panel, parent, client, publish, pending, flush } = setup();
	const changed = vi.fn();
	panel.setNavigationChanged(changed);
	panel.onMount(parent);
	const old = vi.mocked(client.load).mock.calls.at(-1)?.at(0);
	panel.refresh();
	old?.([toy(99)]);
	flush();
	expect(panel.getNavGrid()).toEqual([]);
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)(
		Array.from({ length: 25 }, (_, index) => toy(index + 1)),
	);
	pending.shift()?.();
	expect(changed).not.toHaveBeenCalled();
	panel.onUnmount();
	flush();
	expect(panel.getNavGrid()).toEqual([]);
	panel.onMount(parent);
	publish([toy(1)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["toy-1"]);
	expect(changed).toHaveBeenCalledOnce();
});
