import { afterEach, expect, it, vi } from "vitest";
import type {
	Heirloom,
	IHeirloomsClient,
} from "../../clients/heirlooms-client";
import { Frame } from "../../ui/components/frame";
import { SearchFilters } from "../../ui/components/search-filters";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { HeirloomsPanel } from "./heirlooms-panel";

afterEach(() => vi.restoreAllMocks());
const heirloom = (id: number, collected = true): Heirloom => ({
	id,
	name: `Heirloom ${id}`,
	icon: id,
	collected,
	equipLocation: "INVTYPE_CHEST",
	upgradeLevel: 2,
	maxLevel: 70,
	source: "Dungeon",
	displayed: true,
});
function setup() {
	for (const method of [
		"fill",
		"setWindowBackground",
		"setParent",
		"layout",
		"inset",
		"onSizeChanged",
		"onVerticalScroll",
		"setScrollContent",
		"clampScroll",
		"setIcon",
		"setOpacity",
		"setBackgroundOpacity",
		"setColor",
		"setLabel",
		"setHoverTooltip",
		"setTooltip",
		"onClick",
		"show",
		"hide",
		"destroy",
		"revealVerticalRange",
		"scrollToEdge",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	vi.spyOn(Frame.prototype, "getVisibleVerticalRange").mockReturnValue({
		top: 0,
		bottom: 400,
	});
	vi.spyOn(Frame.prototype, "navigationNode").mockImplementation(
		(id, interact, focus) => ({
			navId: id,
			onInteract: interact,
			onFocus: focus,
		}),
	);
	for (const method of ["mount", "hide", "destroy", "setOptions"] as const)
		vi.spyOn(SearchFilters.prototype, method).mockImplementation(() => {});
	vi.spyOn(SearchFilters.prototype, "getNavGrid").mockReturnValue([]);
	const pending: (() => void)[] = [];
	const scheduler = {
		nextFrame: (job: () => void) => {
			pending.push(job);
			return () => {
				const index = pending.indexOf(job);
				if (index >= 0) pending.splice(index, 1);
			};
		},
		delay: () => () => {},
	};
	const client: IHeirloomsClient = {
		load: vi.fn(() => vi.fn()),
		search: vi.fn(),
		getFilters: () => [],
		toggleFilter: vi.fn(),
		prefetch: vi.fn(),
		refreshEntry: vi.fn(),
		stop: vi.fn(),
		create: vi.fn(),
		isInCombat: vi.fn(() => false),
	};
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	const panel = new HeirloomsPanel(pool, client, scheduler, close);
	const parent = new Frame("parent", pool);
	const publish = (rows: Heirloom[], complete = true) =>
		vi.mocked(client.load).mock.lastCall?.at(0)(rows, complete);
	return {
		panel,
		parent,
		client,
		publish,
		close,
		flush: () => {
			while (pending.length) pending.shift()?.();
		},
	};
}
it("offers creation for collected items, item tooltips for all entries and guards stale actions", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([heirloom(1), heirloom(2, false)]);
	flush();
	const [owned, missing] = panel.getNavGrid().flat();
	expect(owned?.tooltipItem?.()).toEqual({ item: 1 });
	expect(missing?.tooltipItem?.()).toEqual({ item: 2 });
	owned?.onAlternate?.();
	missing?.onAlternate?.();
	expect(client.create).toHaveBeenCalledExactlyOnceWith(1);
	expect(Frame.prototype.setBackgroundOpacity).toHaveBeenCalledWith(0.2);
	expect(Frame.prototype.setOpacity).not.toHaveBeenCalled();
	owned?.onFocus?.();
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"details",
		"Heirloom 1 · Upgrade 2 · Level 70",
		"BOTTOMLEFT",
		16,
		36,
		12,
	);
	panel.onUnmount();
	owned?.onAlternate?.();
	expect(client.create).toHaveBeenCalledTimes(1);
	expect(owned?.tooltipItem?.()).toBeUndefined();
});
it("batches rendering, reports progress, reuses controls and cancels hidden subscriptions", () => {
	const { panel, parent, publish, client, flush } = setup();
	panel.onMount(parent);
	vi.mocked(client.load).mock.lastCall?.at(1)?.(20, 45);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"loading",
		"Loading heirlooms... 20 / 45",
		"BOTTOMRIGHT",
		-16,
		16,
		12,
	);
	publish(Array.from({ length: 30 }, (_, index) => heirloom(index + 1)));
	expect(panel.getNavGrid().flat().length).toBeLessThan(30);
	flush();
	expect(panel.getNavGrid().flat()).toHaveLength(30);
	const first = panel.getNavGrid().flat().at(0);
	panel.onUnmount();
	expect(
		vi.mocked(client.load).mock.results.at(0)?.value,
	).toHaveBeenCalledOnce();
	panel.onMount(parent);
	publish(Array.from({ length: 30 }, (_, index) => heirloom(index + 1)));
	flush();
	expect(panel.getNavGrid().flat().at(0)?.mouseTarget).toBe(first?.mouseTarget);
	panel.getNavGrid().flat().at(0)?.onAlternate?.();
	expect(client.create).toHaveBeenCalledOnce();
});
it("defers native work in combat and resumes loading once combat ends", () => {
	const { panel, parent, client } = setup();
	vi.mocked(client.isInCombat).mockReturnValue(true);
	panel.onMount(parent);
	expect(client.load).not.toHaveBeenCalled();
	vi.mocked(client.isInCombat).mockReturnValue(false);
	panel.resume();
	expect(client.load).toHaveBeenCalledOnce();
});

it("rebinds unchanged cached rows after a search refresh and discards stale callbacks", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([heirloom(1)]);
	flush();
	const previous = panel.getNavGrid().flat().at(0);
	const oldLoad = vi.mocked(client.load).mock.lastCall?.at(0);
	panel.refresh();
	publish([heirloom(1)]);
	flush();
	previous?.onAlternate?.();
	expect(client.create).not.toHaveBeenCalled();
	panel.getNavGrid().flat().at(0)?.onAlternate?.();
	expect(client.create).toHaveBeenCalledExactlyOnceWith(1);
	oldLoad?.([heirloom(2)], true);
	flush();
	expect(panel.getNavGrid().flat().at(0)?.tooltipItem?.()).toEqual({ item: 1 });
});
