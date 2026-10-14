import { afterEach, expect, it, vi } from "vitest";
import type { IPetsClient, Pet } from "../../clients/pets-client";
import { Dropdown } from "../../ui/components/dropdown";
import { Frame } from "../../ui/components/frame";
import { SearchFilters } from "../../ui/components/search-filters";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { PetsPanel } from "./pets-panel";

it("renders one tile per pet species with a duplicate count, clears reused badges and supplies collection tooltips", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	const first = {
		...pet(1),
		source: "Vendor",
		description: "A cat.",
		ownedCount: 2,
	};
	publish([first, { ...first, id: "Pet-2" }]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => node.navId.startsWith("pet-")),
	).toHaveLength(1);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"copies",
		"2/3",
		"BOTTOMRIGHT",
		-1,
		1,
		10,
	);
	const hover = vi.mocked(Frame.prototype.setHoverTooltip).mock.lastCall?.at(0);
	expect(hover?.()).toMatchObject({
		pet: { id: "Pet-1", source: "Vendor", collected: true },
	});
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "pet-Pet-1")
			?.tooltipItem?.(),
	).toMatchObject({ pet: { id: "Pet-1", source: "Vendor" } });
	panel.refresh();
	vi.mocked(Frame.prototype.setLabel).mockClear();
	publish([{ ...first, ownedCount: 1 }]);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"copies",
		"",
		"BOTTOMRIGHT",
		-1,
		1,
		10,
	);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});
const pet = (id: number, expansionId = 10, favourite = false): Pet => ({
	id: `Pet-${id}`,
	speciesId: id,
	name: `Pet ${String(id).padStart(2, "0")}`,
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
		"setTooltip",
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
		"setHoverTooltip",
		"setLabel",
		"show",
		"hide",
		"setFocused",
		"destroy",
		"onClick",
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
	const client: IPetsClient = {
		search: vi.fn(),
		getFilters: vi.fn(() => []),
		toggleFilter: vi.fn(),
		prefetch: vi.fn(),
		refreshEntry: vi.fn(),
		stop: vi.fn(),
		load: vi.fn(() => vi.fn()),
		isInCombat: vi.fn(() => false),
		canUse: vi.fn(() => true),
		summon: vi.fn(),
		summonFavourite: vi.fn(),
		toggleFavourite: vi.fn(),
	};
	const menu = { open: vi.fn(), close: vi.fn() };
	const pool = {} as IFramePoolManager;
	const panel = new PetsPanel(pool, client, menu, scheduler, vi.fn());
	const parent = new Frame("parent", pool);
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	const publish = (pets: Pet[]) => {
		vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(pets);
		flush();
	};
	return { panel, parent, client, menu, pending, publish, flush };
}

it("searches pets and refreshes native family filters without removing the summon action", () => {
	vi.useFakeTimers();
	const { panel, parent, client } = setup();
	vi.mocked(SearchFilters.prototype.mount).mockRestore();
	vi.spyOn(Dropdown.prototype, "mount").mockImplementation(() => {});
	vi.mocked(client.getFilters).mockReturnValue([
		{ id: "family:1", label: "Family: Humanoid", checked: true },
	]);
	panel.onMount(parent);
	const search = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "pets-search");
	expect(search).toBeDefined();
	search?.onInteract();
	expect(Frame.prototype.focusInput).toHaveBeenCalled();
	vi.mocked(Frame.prototype.configureInput).mock.lastCall?.at(0)?.("cat");
	expect(client.search).not.toHaveBeenCalled();
	vi.advanceTimersByTime(299);
	expect(client.search).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(client.search).toHaveBeenCalledWith("cat");
	expect(client.load).toHaveBeenCalledTimes(2);
	const option = vi
		.mocked(SearchFilters.prototype.setOptions)
		.mock.lastCall?.at(0)
		.at(0);
	expect(option).toMatchObject({ id: "family:1", checked: true });
	option?.activate();
	expect(client.toggleFilter).toHaveBeenCalledWith("family:1");
	expect(client.load).toHaveBeenCalledTimes(3);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "pets-summon-favourite"),
	).toBe(true);
	expect(Frame.prototype.inset).toHaveBeenCalledWith(
		expect.any(Frame),
		16,
		112,
		16,
		114,
	);
});

it("hosts the random favourite pet action in a mounts-style bottom bar after the collection grid", () => {
	const { panel, parent, client, publish } = setup();
	panel.onMount(parent);
	publish([pet(1)]);
	const footer = vi
		.mocked(Frame.prototype.setInsetBackground)
		.mock.contexts.find((frame) => frame.id === "pets-footer");
	expect(footer).toBeDefined();
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		456,
		70,
		"BOTTOMLEFT",
		expect.any(Frame),
		12,
		32,
	);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		38,
		38,
		"TOPLEFT",
		footer,
		12,
		-26,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"random",
		"Favourite pet",
		"TOPLEFT",
		12,
		-8,
		12,
	);
	expect(Frame.prototype.setTooltip).toHaveBeenCalledWith(
		"Summon a random favourite pet",
	);
	expect(
		panel
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["pet-Pet-1", "pets-summon-favourite"]);
	panel.getNavGrid().at(-1)?.at(0)?.onInteract();
	expect(client.summonFavourite).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.destroy();
	expect(vi.mocked(Frame.prototype.destroy).mock.contexts).not.toContain(
		footer,
	);
});
it("groups favourites and expansions in descending order and summons through X and the favourite button", () => {
	const { panel, parent, client, menu, publish } = setup();
	panel.onMount(parent);
	publish([pet(3, 0), pet(2, 11), pet(1, 0, true)]);
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toEqual([
		["pet-favourite-Pet-1"],
		["pet-Pet-2"],
		["pet-Pet-1", "pet-Pet-3"],
		["pets-summon-favourite"],
	]);
	const first = panel.getNavGrid().at(0)?.at(0);
	first?.onAlternate?.();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith("Pet-1");
	first?.onContext?.();
	expect(menu.open).toHaveBeenCalledExactlyOnceWith({
		...pet(1, 0, true),
		ownedCount: 1,
	});
	expect(first?.tooltipItem?.()).toEqual({
		pet: { ...pet(1, 0, true), ownedCount: 1 },
	});
	panel.getNavGrid().at(-1)?.at(0)?.onInteract();
	expect(client.summonFavourite).toHaveBeenCalledOnce();
	panel.refresh();
	first?.onAlternate?.();
	first?.onContext?.();
	expect(client.summon).toHaveBeenCalledTimes(2);
	expect(menu.open).toHaveBeenCalledTimes(2);
});
it("renders at most ten jobs per frame and reuses the completed view on unchanged reopening", () => {
	const { panel, parent, client, flush } = setup();
	panel.onMount(parent);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(
		Array.from({ length: 25 }, (_, i) => pet(i + 1)),
	);
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(9);
	expect(panel.getNavGrid().slice(0, -1).flat()).toHaveLength(9);
	flush();
	expect(
		panel
			.getNavGrid()
			.slice(0, -1)
			.map((row) => row.length),
	).toEqual([10, 10, 5]);
	const first = panel.getNavGrid().at(0)?.at(0);
	const summon = panel.getNavGrid().at(-1)?.at(0);
	panel.onUnmount();
	vi.mocked(Frame.prototype.setIcon).mockClear();
	panel.onMount(parent);
	flush();
	expect(client.load).toHaveBeenCalledTimes(2);
	expect(
		vi.mocked(Frame.prototype.setIcon).mock.contexts.map((frame) => frame.id),
	).toEqual(["pets-summon-favourite"]);
	expect(panel.getNavGrid().at(0)?.at(0)).toBe(first);
	expect(panel.getNavGrid().at(-1)?.at(0)).toBe(summon);
});
it("defers hidden changes, retains warm actions during event bursts and refreshes on reopening", () => {
	const { panel, parent, client, publish, flush } = setup();
	expect(client.load).not.toHaveBeenCalled();
	panel.onMount(parent);
	publish([pet(1)]);
	for (let i = 0; i < 5; i++) publish([pet(1)]);
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	panel.getNavGrid().at(0)?.at(0)?.onAlternate?.();
	expect(client.summon).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([pet(2)]);
	expect(
		panel
			.getNavGrid()
			.slice(0, -1)
			.flat()
			.map((node) => node.navId),
	).toEqual(["pet-Pet-2"]);
});
it("cancels partial rendering and excludes uncollected pets from summoning", () => {
	const { panel, parent, client, publish, pending, flush } = setup();
	panel.onMount(parent);
	publish([{ ...pet(1), collected: false }]);
	panel.getNavGrid().at(0)?.at(0)?.onAlternate?.();
	expect(client.summon).not.toHaveBeenCalled();
	panel.refresh();
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(
		Array.from({ length: 25 }, (_, i) => pet(i + 1)),
	);
	pending.shift()?.();
	panel.onUnmount();
	vi.mocked(Frame.prototype.setIcon).mockClear();
	flush();
	expect(Frame.prototype.setIcon).not.toHaveBeenCalled();
	panel.onMount(parent);
	publish([pet(2)]);
	expect(panel.getNavGrid().slice(0, -1).flat()).toHaveLength(1);
});
it("defers loading in combat, resumes afterwards and lays out resizing without rescans", () => {
	const { panel, parent, client, publish } = setup();
	vi.mocked(client.isInCombat).mockReturnValue(true);
	panel.onMount(parent);
	expect(client.load).not.toHaveBeenCalled();
	vi.mocked(client.isInCombat).mockReturnValue(false);
	panel.resume();
	publish([pet(1)]);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	vi.mocked(Frame.prototype.onSizeChanged).mock.lastCall?.at(0)?.();
	expect(client.load).toHaveBeenCalledOnce();
	expect(Frame.prototype.setIcon).not.toHaveBeenCalled();
});

it("renders cached pets immediately and updates only changed tiles from the live subscription", () => {
	const { panel, parent, client, flush } = setup();
	const first = pet(1);
	const second = pet(2);
	vi.mocked(client.load).mockImplementation((done) => {
		done([first, second], true);
		return () => {};
	});
	panel.onMount(parent);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "pet-Pet-1"),
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
		.mock.contexts.filter((frame) => frame.id.startsWith("pets-icon-"));
	expect(icons.map((frame) => frame.id)).toEqual(["pets-icon-1"]);
});

it("detaches on close, resubscribes on reopening, and retains pet frames for the session", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([pet(1), pet(2)]);
	const originals = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("pets-icon-"));
	const detach = vi.mocked(client.load).mock.results.at(0)?.value;
	panel.onUnmount();
	expect(detach).toHaveBeenCalledOnce();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([pet(3)]);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	publish([pet(1), pet(2)]);
	flush();
	const returned = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("pets-icon-"));
	expect(returned).toEqual(originals);
	panel.destroy();
	expect(Frame.prototype.destroy).not.toHaveBeenCalled();
	expect(SearchFilters.prototype.destroy).not.toHaveBeenCalled();
});
