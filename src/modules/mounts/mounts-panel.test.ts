import { afterEach, expect, it, vi } from "vitest";
import type { IMountsClient, Mount } from "../../clients/mounts-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { MountsPanel } from "./mounts-panel";

afterEach(() => vi.restoreAllMocks());
const mount = (id: number, favourite = false): Mount => ({
	id,
	index: id,
	name: `Mount ${id}`,
	spell: id,
	icon: id,
	collected: true,
	usable: true,
	favourite,
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
		"setTooltip",
		"setLabel",
		"show",
		"hide",
		"setFocused",
		"destroy",
		"revealVerticalRange",
		"configureInput",
		"onClick",
		"onDragStart",
		"onReceiveDrag",
		"setSpell",
		"click",
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
	const cancel = vi.fn();
	const client: IMountsClient = {
		load: vi.fn(() => cancel),
		getMounts: vi.fn(() => []),
		getCount: vi.fn(() => ({ collected: 0, total: 0 })),
		search: vi.fn(),
		getFilters: vi.fn(() => []),
		toggleFilter: vi.fn(),
		toggleFavourite: vi.fn(),
		getEquipment: () => ({ icon: 789, label: "Equipment", link: "item:1" }),
		applyEquipment: vi.fn(),
		getUtilitySpells: () => ({ favourite: 150544, flight: 460002 }),
		summon: vi.fn(),
		pickupRandom: vi.fn(),
	};
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	const panel = new MountsPanel(pool, client, close, scheduler);
	const parent = new Frame("parent", pool);
	const flush = () => {
		while (pending.length) pending.shift()?.();
	};
	const publish = (mounts: Mount[]) => {
		vi.mocked(client.load).mock.calls.at(-1)?.[0](mounts, {
			collected: 45,
			total: 100,
		});
		flush();
	};
	return { panel, parent, client, pending, flush, publish, cancel, close };
}

it("shows favourites first without removing them from the ten-column collection grid", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([
		mount(1, true),
		...Array.from({ length: 11 }, (_, i) => mount(i + 2)),
	]);
	const rows = panel
		.getNavGrid()
		.filter((row) => row.at(0)?.navId.startsWith("mount-"));
	expect(rows.map((row) => row.length)).toEqual([1, 10, 2]);
	expect(rows.at(0)?.at(0)?.navId).toBe("mount-favourite-1");
	expect(rows.flat().filter((node) => node.navId === "mount-1")).toHaveLength(
		1,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"title",
		"Favourites (1 / 1)",
		"LEFT",
		0,
		0,
		15,
		460,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"title",
		"Mounts (12 / 12)",
		"LEFT",
		0,
		0,
		15,
		460,
	);
	rows.at(-1)?.at(-1)?.onFocus();
	expect(Frame.prototype.revealVerticalRange).toHaveBeenCalled();
});

it("dims missing mounts, prevents unavailable summons and toggles favourites through context actions", () => {
	const { panel, parent, client, publish } = setup();
	panel.onMount(parent);
	publish([
		mount(1),
		{ ...mount(2), usable: false },
		{ ...mount(3), collected: false },
	]);
	const nodes = panel
		.getNavGrid()
		.flat()
		.filter((node) => /^mount-\d+$/.test(node.navId));
	for (const node of nodes) node.onInteract();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith(1);
	expect(Frame.prototype.setOpacity).toHaveBeenCalledWith(0.2);
	nodes.at(2)?.onContext?.();
	expect(client.toggleFavourite).not.toHaveBeenCalled();
	nodes.at(0)?.onContext?.();
	expect(client.toggleFavourite).toHaveBeenCalledExactlyOnceWith(1);
	panel.onUnmount();
	nodes.at(0)?.onInteract();
	expect(client.summon).toHaveBeenCalledTimes(1);
});

it("keeps a first page usable, displays bottom progress, rejects stale loads and reuses completed controls", () => {
	const { panel, parent, client, pending, flush, publish, cancel } = setup();
	panel.onMount(parent);
	const initial = vi.mocked(client.load).mock.calls.at(-1);
	initial?.[2]?.(20, 40);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		35,
		4,
		"TOPLEFT",
		expect.anything(),
	);
	initial?.[1]?.([mount(1)]);
	flush();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1")
		?.onInteract();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith(1);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		140,
		4,
		"BOTTOMRIGHT",
		expect.anything(),
		-16,
		8,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"loading",
		"Loading mounts...",
		"BOTTOMRIGHT",
		-16,
		16,
		12,
	);
	panel.onUnmount();
	expect(cancel).toHaveBeenCalledOnce();
	panel.onMount(parent);
	initial?.[0]([mount(99)], { collected: 99, total: 99 });
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-99"),
	).toBe(false);
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		Array.from({ length: 45 }, (_, i) => mount(i + 1)),
		{ collected: 45, total: 100 },
	);
	pending.shift()?.();
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => /^mount-\d+$/.test(node.navId)).length,
	).toBeLessThan(45);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => /^mount-\d+$/.test(node.navId)),
	).toHaveLength(45);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"count",
		"45 / 100",
		"TOPLEFT",
		16,
		-44,
		14,
	);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
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
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1")
		?.onInteract();
	expect(client.summon).toHaveBeenCalledTimes(2);
	panel.refresh();
	publish([mount(1)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => /^mount-\d+$/.test(node.navId)),
	).toHaveLength(1);
	panel.destroy();
});

it("reuses pooled icons on refresh and hides surplus controls when favourites disappear", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([mount(1, true), mount(2)]);
	const icons = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("mounts-icon-"));
	vi.mocked(Frame.prototype.setIcon).mockClear();
	panel.refresh();
	publish([mount(1), mount(2)]);
	const reused = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("mounts-icon-"));
	expect(reused).toEqual(icons.slice(0, 2));
	expect(
		vi
			.mocked(Frame.prototype.hide)
			.mock.contexts.some((frame) => frame.id === "mounts-icon-2"),
	).toBe(true);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.startsWith("mount-favourite-")),
	).toBe(false);
});

it("preserves search, filters, equipment and extra actions in a 70px footer", () => {
	const { panel, parent, client, publish, close } = setup();
	vi.mocked(client.getFilters).mockReturnValue([
		{ id: "collection:1", label: "Collected", checked: true },
	]);
	panel.onMount(parent);
	publish([mount(1)]);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		456,
		70,
		"BOTTOMLEFT",
		expect.anything(),
		12,
		32,
	);
	expect(Frame.prototype.setIcon).toHaveBeenCalledWith(789);
	expect(Frame.prototype.setSpell).toHaveBeenCalledWith(460002);
	vi.mocked(Frame.prototype.configureInput).mock.calls.at(-1)?.[0]("horse");
	expect(client.search).toHaveBeenCalledWith("horse");
	vi.mocked(Frame.prototype.onDragStart).mock.calls.at(-1)?.[0]?.();
	expect(client.pickupRandom).toHaveBeenCalledOnce();
	vi.mocked(Frame.prototype.onReceiveDrag).mock.calls.at(-1)?.[0]?.();
	expect(client.applyEquipment).toHaveBeenCalledOnce();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mounts-filters")
		?.onInteract();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "collection:1")
		?.onInteract();
	expect(client.toggleFilter).toHaveBeenCalledExactlyOnceWith("collection:1");
	panel.onUnmount();
	expect(close).not.toHaveBeenCalled();
	panel.onContainerClosed();
	expect(close).toHaveBeenCalledOnce();
});

it("renders an empty collection without an empty group header", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([]);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"empty",
		"No mounts to display",
		"TOPLEFT",
		0,
		-10,
	);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.startsWith("mount-")),
	).toBe(false);
	expect(
		vi
			.mocked(Frame.prototype.setLabel)
			.mock.contexts.some((frame) => frame.id.startsWith("mounts-header-")),
	).toBe(false);
});
