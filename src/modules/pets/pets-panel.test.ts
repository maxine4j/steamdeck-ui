import { afterEach, expect, it, vi } from "vitest";
import type { IPetsClient, Pet } from "../../clients/pets-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { PetsPanel } from "./pets-panel";

afterEach(() => vi.restoreAllMocks());
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
	for (const method of [
		"fill",
		"setWindowBackground",
		"setButtonBackground",
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
	const client: IPetsClient = {
		prefetch: vi.fn(),
		invalidate: vi.fn(),
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
it("groups favourites and expansions in descending order and summons through X and the favourite button", () => {
	const { panel, parent, client, menu, publish } = setup();
	panel.onMount(parent);
	publish([pet(3, 0), pet(2, 11), pet(1, 0, true)]);
	expect(
		panel.getNavGrid().map((row) => row.map((node) => node.navId)),
	).toEqual([
		["pets-summon-favourite"],
		["pet-favourite-Pet-1"],
		["pet-Pet-2"],
		["pet-Pet-1", "pet-Pet-3"],
	]);
	const first = panel.getNavGrid().at(1)?.at(0);
	first?.onAlternate?.();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith("Pet-1");
	first?.onContext?.();
	expect(menu.open).toHaveBeenCalledExactlyOnceWith(pet(1, 0, true));
	expect(first?.tooltipItem?.()).toEqual({ text: "Pet 01" });
	panel.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(client.summonFavourite).toHaveBeenCalledOnce();
	panel.refresh();
	first?.onAlternate?.();
	first?.onContext?.();
	expect(client.summon).toHaveBeenCalledOnce();
	expect(menu.open).toHaveBeenCalledOnce();
});
it("renders at most ten jobs per frame and reuses the completed view on unchanged reopening", () => {
	const { panel, parent, client, pending, flush } = setup();
	panel.onMount(parent);
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(
		Array.from({ length: 25 }, (_, i) => pet(i + 1)),
	);
	pending.shift()?.();
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(9);
	expect(panel.getNavGrid().slice(1).flat()).toHaveLength(9);
	flush();
	expect(
		panel
			.getNavGrid()
			.slice(1)
			.map((row) => row.length),
	).toEqual([10, 10, 5]);
	const first = panel.getNavGrid().at(1)?.at(0);
	const summon = panel.getNavGrid().at(0)?.at(0);
	panel.onUnmount();
	vi.mocked(Frame.prototype.setIcon).mockClear();
	panel.onMount(parent);
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	expect(Frame.prototype.setIcon).not.toHaveBeenCalled();
	expect(panel.getNavGrid().at(1)?.at(0)).toBe(first);
	expect(panel.getNavGrid().at(0)?.at(0)).toBe(summon);
});
it("defers hidden changes, retains warm actions during event bursts and refreshes on reopening", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.invalidate();
	expect(client.load).not.toHaveBeenCalled();
	panel.onMount(parent);
	publish([pet(1)]);
	for (let i = 0; i < 5; i++) panel.invalidate();
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	panel.getNavGrid().at(1)?.at(0)?.onAlternate?.();
	expect(client.summon).toHaveBeenCalledOnce();
	panel.onUnmount();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([pet(2)]);
	expect(
		panel
			.getNavGrid()
			.slice(1)
			.flat()
			.map((node) => node.navId),
	).toEqual(["pet-Pet-2"]);
});
it("cancels partial rendering and excludes uncollected pets from summoning", () => {
	const { panel, parent, client, publish, pending, flush } = setup();
	panel.onMount(parent);
	publish([{ ...pet(1), collected: false }]);
	panel.getNavGrid().at(1)?.at(0)?.onAlternate?.();
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
	expect(panel.getNavGrid().slice(1).flat()).toHaveLength(1);
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
