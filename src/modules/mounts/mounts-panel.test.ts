import { afterEach, expect, it, vi } from "vitest";
import type { IMountsClient, Mount } from "../../clients/mounts-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../../ui/components/frame";
import type {
	NativeDropdownButton,
	NativeMenuRoot,
} from "../../ui/components/native-menu";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { NavigationManager } from "../../ui/navigation/navigation-manager";
import { MountsPanel } from "./mounts-panel";

it("uses shared focus arrival styling for footer actions", () => {
	const { panel, parent } = setup();
	panel.onMount(parent);
	expect(Frame.prototype.inset).toHaveBeenCalledWith(
		expect.anything(),
		16,
		112,
		8,
		114,
	);
	const footer = panel.getNavGrid().at(-1)?.at(0);
	footer?.onFocus();
	expect(Frame.prototype.setFocused).toHaveBeenCalledWith(true);
	footer?.onFocus(true);
	expect(Frame.prototype.setFocused).toHaveBeenCalledWith(true, false, true);
	footer?.onBlur();
	expect(Frame.prototype.setFocused).toHaveBeenCalledWith(false);
});

it("uses mount journal tooltip data for mouse hover and controller focus, including uncollected mounts", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([{ ...mount(1), collected: false }]);
	const hover = vi.mocked(Frame.prototype.setHoverTooltip).mock.lastCall?.at(0);
	expect(hover?.()).toEqual({ mountSpell: 1 });
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "mount-1")
			?.tooltipItem?.(),
	).toEqual({ mountSpell: 1 });
	panel.onUnmount();
	expect(hover?.()).toBeUndefined();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
it("uses the native search box proportions without a custom inset background", () => {
	const { panel, parent } = setup();
	panel.onMount(parent);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		300,
		20,
		"TOPLEFT",
		expect.any(Frame),
		16,
		-66,
	);
	expect(
		vi
			.mocked(Frame.prototype.setInsetBackground)
			.mock.contexts.some((frame) => frame.id === "mounts-search"),
	).toBe(false);
});

it("debounces mount searches for 300ms after the final text change and cancels hidden work", () => {
	vi.useFakeTimers();
	const { panel, parent, client } = setup();
	panel.onMount(parent);
	const change = vi.mocked(Frame.prototype.configureInput).mock.lastCall?.at(0);
	change?.("h");
	vi.advanceTimersByTime(250);
	change?.("horse");
	vi.advanceTimersByTime(299);
	expect(client.search).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(client.search).toHaveBeenCalledExactlyOnceWith("horse");
	change?.("cat");
	panel.onUnmount();
	vi.advanceTimersByTime(500);
	expect(client.search).toHaveBeenCalledOnce();
	panel.destroy();
});
it("shows controller graphics beside summon action descriptions", () => {
	const { panel, parent } = setup();
	panel.onMount(parent);
	expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
		"actions",
		expect.stringContaining("xbox_r_x.blp:18:18|t Summon"),
		"BOTTOMLEFT",
		16,
		16,
		12,
	);
});

it("keeps a warm mount view and summon actions unchanged until reopening after invalidation", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([mount(1)]);
	const first = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1");
	vi.mocked(Frame.prototype.setIcon).mockClear();
	for (let event = 0; event < 5; event++) panel.onJournalSearchUpdated();
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	expect(Frame.prototype.setIcon).not.toHaveBeenCalled();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "mount-1"),
	).toBe(first);
	first?.onAlternate?.();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith(1);
	panel.onUnmount();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	publish([mount(1), mount(2)]);
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => node.navId.startsWith("mount-")),
	).toHaveLength(2);
	panel.destroy();
});

it("retains a focused mount across refreshes and reordered loading snapshots", () => {
	const { panel, parent, client, pending, flush, publish } = setup();
	const nav = new NavigationManager(createTestEventBus());
	panel.onMount(parent);
	const mounts = Array.from({ length: 40 }, (_, index) => ({
		...mount(index + 1),
		name: `Mount ${String(index + 1).padStart(2, "0")}`,
	}));
	publish(mounts.slice(10, 30));
	nav.registerGrid("mounts", () => panel.getNavGrid());
	nav.setActiveGrid("mounts");
	panel.setNavigationChanged(() => nav.refreshGrid("mounts"));
	nav.refreshGrid("mounts", "mount-21");
	panel.refresh();
	expect(nav.focusedId).toBe("mount-21");
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		mounts.slice(10, 30),
		{ collected: 20, total: 20 },
		false,
	);
	flush();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-21")
		?.navigationScroll?.scrollToEdge("down");
	expect(Frame.prototype.scrollToEdge).not.toHaveBeenCalled();
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(mounts, {
		collected: 40,
		total: 40,
	});
	while (pending.length) {
		pending.shift()?.();
		expect(nav.focusedId).toBe("mount-21");
		const focused = panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "mount-21");
		expect(focused?.tooltipItem?.()).toEqual({ mountSpell: 21 });
	}
	nav.destroy();
	panel.destroy();
});
it("shows Blizzard's favourite star and clears it when a cell is reused", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([mount(1, true)]);
	expect(Frame.prototype.setAtlasBackground).toHaveBeenCalledWith(
		"PetJournal-FavoritesIcon",
	);
	const star = vi
		.mocked(Frame.prototype.setAtlasBackground)
		.mock.contexts.at(0);
	expect(vi.mocked(Frame.prototype.show).mock.contexts).toContain(star);
	const colors = vi.mocked(Frame.prototype.setColor);
	expect(
		colors.mock.calls.filter((_, index) =>
			colors.mock.contexts.at(index)?.id.startsWith("mounts-border-"),
		),
	).toEqual([
		[0.3, 0.34, 0.42],
		[0.3, 0.34, 0.42],
	]);
	panel.refresh();
	vi.mocked(Frame.prototype.hide).mockClear();
	publish([mount(1)]);
	expect(vi.mocked(Frame.prototype.hide).mock.contexts).toContain(star);
	panel.destroy();
	expect(vi.mocked(Frame.prototype.destroy).mock.contexts).not.toContain(star);
});
const mount = (id: number, favourite = false): Mount => ({
	id,
	index: id,
	name: `Mount ${id}`,
	spell: id,
	icon: id,
	collected: true,
	usable: true,
	favourite,
	expansionId: 0,
});

function setup(performance?: { now(): number; log(message: string): void }) {
	vi.spyOn(Frame.prototype, "getVisibleVerticalRange").mockReturnValue({
		top: 0,
		bottom: 1000,
	});
	vi.stubGlobal("MenuResponse", { Refresh: 2, Close: 3 });
	vi.stubGlobal("MenuInputContext", { None: 1 });
	const menuCallbacks = new Map<string, () => void>();
	let menuOpen = false;
	let generator:
		| ((button: NativeDropdownButton, root: NativeMenuRoot) => void)
		| undefined;
	const checkbox = (
		_label: string,
		_checked: () => boolean,
		respond: () => number,
	) => ({
		AddInitializer: vi.fn(),
		HandleOnEnter: vi.fn(),
		HandleOnLeave: vi.fn(),
		Pick: () => {
			if (respond() === 3) dropdown.CloseMenu();
		},
	});
	const root = {
		SetScrollMode: vi.fn(),
		CreateCheckbox: checkbox,
		CreateRadio: checkbox,
		CreateButton: (label: string, respond: () => number) =>
			checkbox(label, () => false, respond),
	};
	const dropdown = {
		SetupMenu: (generate: typeof generator) => {
			generator = generate;
			generator?.(dropdown as unknown as NativeDropdownButton, root);
		},
		RegisterCallback: (event: string, callback: () => void) =>
			menuCallbacks.set(event, callback),
		UnregisterCallback: vi.fn(),
		ClearMenuState: vi.fn(),
		IsMenuOpen: () => menuOpen,
		SetMenuOpen: (open: boolean) => {
			menuOpen = open;
			generator?.(dropdown as unknown as NativeDropdownButton, root);
			menuCallbacks.get(open ? "OnMenuOpen" : "OnMenuClose")?.();
		},
		CloseMenu: () => {
			if (menuOpen) {
				menuOpen = false;
				menuCallbacks.get("OnMenuClose")?.();
			}
		},
	};
	vi.spyOn(Frame.prototype, "getDropdownButton").mockReturnValue(
		dropdown as unknown as NativeDropdownButton,
	);
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
		"onVerticalScroll",
		"setScrollContent",
		"clampScroll",
		"setIcon",
		"setAtlasBackground",
		"setOpacity",
		"setTooltip",
		"setHoverTooltip",
		"setLabel",
		"show",
		"hide",
		"setFocused",
		"destroy",
		"revealVerticalRange",
		"scrollToEdge",
		"configureInput",
		"onClick",
		"onDragStart",
		"onReceiveDrag",
		"setSpell",
		"click",
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
	const cancel = vi.fn();
	const client: IMountsClient = {
		prefetch: vi.fn(),
		refreshEntry: vi.fn(),
		refreshDisplay: vi.fn(),
		stop: vi.fn(),
		load: vi.fn(() => cancel),
		getMounts: vi.fn(() => []),
		getCount: vi.fn(() => ({ collected: 0, total: 0 })),
		search: vi.fn(),
		getFilters: vi.fn(() => []),
		toggleFilter: vi.fn(),
		setFavourite: vi.fn((_id, _favourite, onResult) => onResult(true)),
		getFavourite: vi.fn(() => true),
		canUse: vi.fn((id) => id !== 2),
		getEquipment: () => ({ icon: 789, label: "Equipment", link: "item:1" }),
		applyEquipment: vi.fn(),
		getUtilitySpells: () => ({ favourite: 150544, flight: 460002 }),
		summon: vi.fn(),
		pickupRandom: vi.fn(),
	};
	const pool = {} as IFramePoolManager;
	const close = vi.fn();
	const menu = { open: vi.fn(), close: vi.fn() };
	const panel = new MountsPanel(
		pool,
		client,
		close,
		scheduler,
		menu,
		performance,
	);
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
	return {
		panel,
		parent,
		client,
		pending,
		flush,
		publish,
		cancel,
		close,
		menu,
		dropdown,
	};
}

it("prepares mounts one page ahead, retains visited ranges and cancels hidden scroll work", () => {
	const log = vi.fn();
	const { panel, parent, publish, pending, flush } = setup({
		now: () => 0,
		log,
	});
	const range = vi.mocked(Frame.prototype.getVisibleVerticalRange);
	range.mockReturnValue({ top: 0, bottom: 460 });
	panel.onMount(parent);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	publish(Array.from({ length: 1000 }, (_, index) => mount(index + 1)));
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(200);
	const first = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1");
	const scrollTo = (top: number) => {
		range.mockReturnValue({ top, bottom: top + 460 });
		vi.mocked(Frame.prototype.onVerticalScroll).mock.lastCall?.at(0)?.();
	};
	log.mockClear();
	vi.mocked(Frame.prototype.layout).mockClear();
	scrollTo(460);
	expect(pending).toHaveLength(0);
	expect(log).not.toHaveBeenCalled();
	scrollTo(920);
	flush();
	expect(Frame.prototype.setIcon).toHaveBeenCalledTimes(400);
	expect(
		vi.mocked(Frame.prototype.layout).mock.contexts.map((frame) => frame.id),
	).not.toContain("mounts-content");
	log.mockClear();
	for (const top of [460, 0, 920, 460]) scrollTo(top);
	expect(pending).toHaveLength(0);
	expect(log).not.toHaveBeenCalled();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "mount-1"),
	).toBe(first);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	scrollTo(2300);
	panel.onUnmount();
	flush();
	expect(Frame.prototype.setIcon).not.toHaveBeenCalled();
});

it("navigates into deferred mount rows and preserves focus through manual scrolling", () => {
	const { panel, parent, publish, flush } = setup();
	let top = 0;
	vi.mocked(Frame.prototype.getVisibleVerticalRange).mockImplementation(() => ({
		top,
		bottom: top + 184,
	}));
	vi.mocked(Frame.prototype.revealVerticalRange).mockImplementation(
		(start, end) => {
			top = Math.max(
				0,
				start < top ? start - 92 : end > top + 92 ? end - 92 : top,
			);
			vi.mocked(Frame.prototype.onVerticalScroll).mock.lastCall?.at(0)?.();
		},
	);
	panel.onMount(parent);
	publish(
		Array.from({ length: 200 }, (_, index) => ({
			...mount(index + 1),
			name: String(index + 1).padStart(3, "0"),
		})),
	);
	const events = createTestEventBus();
	const nav = new NavigationManager(events);
	nav.registerGrid("mounts", () => panel.getNavGrid());
	nav.setActiveGrid("mounts");
	nav.refreshGrid("mounts", "mount-1");
	panel.setNavigationChanged(() => nav.refreshGrid("mounts"));
	for (let row = 1; row <= 19; row++) {
		events.emit("NAV_DOWN");
		flush();
		expect(nav.focusedId).toBe(`mount-${row * 10 + 1}`);
	}
	top = 0;
	vi.mocked(Frame.prototype.onVerticalScroll).mock.lastCall?.at(0)?.();
	flush();
	expect(top).toBe(0);
	expect(nav.focusedId).toBe("mount-191");
	nav.destroy();
});

it("logs mount render preparation and frame work so repeated idle refreshes can be identified", () => {
	let time = 0;
	const performance = { now: () => time++, log: vi.fn() };
	const { panel, parent, publish } = setup(performance);
	panel.onMount(parent);
	publish([mount(1)]);
	expect(
		performance.log.mock.calls.some(
			(call) =>
				call.at(0)?.includes("mounts render") &&
				call.at(0)?.includes("prepare=") &&
				call.at(0)?.includes("frames="),
		),
	).toBe(true);
});

it("renders the first cached controls immediately and only updates changed mount icons", () => {
	const { panel, parent, client, flush } = setup();
	const first = mount(1);
	const second = mount(2);
	vi.mocked(client.load).mockImplementation((done) => {
		done([first, second], { collected: 2, total: 2 });
		return () => {};
	});
	panel.onMount(parent);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-1"),
	).toBe(true);
	flush();
	vi.mocked(Frame.prototype.setIcon).mockClear();
	vi.mocked(client.load).mock.calls.at(-1)?.[0](
		[first, { ...second, collected: false }],
		{ collected: 1, total: 2 },
	);
	flush();
	const icons = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("mounts-icon-"));
	expect(icons.map((frame) => frame.id)).toEqual(["mounts-icon-1"]);
});

it("detaches cache observers while closed and resubscribes to the latest cache on reopening", () => {
	const { panel, parent, client, publish, cancel, flush } = setup();
	panel.onMount(parent);
	publish([mount(1)]);
	panel.onUnmount();
	expect(cancel).toHaveBeenCalledOnce();
	vi.mocked(client.load).mockImplementation((done) => {
		done([mount(1), mount(2)], { collected: 2, total: 2 });
		return cancel;
	});
	panel.onMount(parent);
	flush();
	expect(client.load).toHaveBeenCalledTimes(2);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-2"),
	).toBe(true);
});

it("retains each mount's frames across filters and shutdown without releasing them to the pool", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([mount(1), mount(2)]);
	const originals = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("mounts-icon-"));
	panel.refresh();
	publish([mount(3)]);
	vi.mocked(Frame.prototype.setIcon).mockClear();
	panel.refresh();
	publish([mount(1), mount(2)]);
	const returned = vi
		.mocked(Frame.prototype.setIcon)
		.mock.contexts.filter((frame) => frame.id.startsWith("mounts-icon-"));
	expect(returned).toEqual(originals);
	panel.destroy();
	expect(
		vi
			.mocked(Frame.prototype.destroy)
			.mock.contexts.some((frame) => frame.id.startsWith("mounts-")),
	).toBe(false);
});

it("blocks clicks on filtered-out retained frames while their batched hiding is pending", () => {
	const { panel, parent, client, publish } = setup();
	panel.onMount(parent);
	publish(Array.from({ length: 45 }, (_, index) => mount(index + 1)));
	const clicks = vi.mocked(Frame.prototype.onClick);
	const lastIcon = clicks.mock.contexts.findLastIndex(
		(frame) => frame.id === "mounts-icon-44",
	);
	const click = clicks.mock.calls.at(lastIcon)?.at(0);
	vi.mocked(client.load).mock.calls.at(-1)?.at(0)?.(
		[],
		{ collected: 0, total: 0 },
		true,
	);
	click?.("LeftButton");
	expect(client.summon).not.toHaveBeenCalled();
});

it("keeps native checkbox filters open and focused across collection refreshes", () => {
	const { panel, parent, client, publish, dropdown } = setup();
	let checked = false;
	vi.mocked(client.getFilters).mockImplementation(() => [
		{ id: "collected", label: "Collected", checked },
	]);
	vi.mocked(client.toggleFilter).mockImplementation(() => {
		checked = !checked;
	});
	panel.onMount(parent);
	publish([mount(1)]);
	const nav = new NavigationManager(createTestEventBus());
	nav.registerGrid(panel.id, () => panel.getNavGrid());
	nav.setActiveGrid(panel.id);
	panel.setNavigationChanged((focusId?: string) =>
		nav.refreshGrid(panel.id, focusId),
	);
	dropdown.SetMenuOpen(true);
	expect(nav.focusedId).toBe("collected");
	nav.interact();
	expect(checked).toBe(true);
	expect(dropdown.IsMenuOpen()).toBe(true);
	expect(nav.focusedId).toBe("collected");
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-1"),
	).toBe(false);
	dropdown.CloseMenu();
	expect(nav.focusedId).toBe("mounts-filters");
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-1"),
	).toBe(true);
	nav.destroy();
	panel.destroy();
});

it("shows favourites first without removing them from the ten-column collection grid", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	expect(Frame.prototype.setCloseButtonBackground).not.toHaveBeenCalled();
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
		"Classic (12 / 12)",
		"LEFT",
		0,
		0,
		15,
		460,
	);
	rows.at(-1)?.at(-1)?.onFocus();
	expect(Frame.prototype.revealVerticalRange).toHaveBeenCalled();
	rows.at(-1)?.at(-1)?.navigationScroll?.scrollToEdge("down");
	expect(Frame.prototype.scrollToEdge).toHaveBeenLastCalledWith("down");
});

it("dims missing mounts, prevents unavailable summons and opens options on controller context", () => {
	const { panel, parent, client, publish, menu } = setup();
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
	expect(client.summon).not.toHaveBeenCalled();
	for (const node of nodes) node.onAlternate?.();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith(1);
	expect(Frame.prototype.setOpacity).toHaveBeenCalledWith(0.2);
	nodes.at(2)?.onContext?.();
	expect(menu.open).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
	nodes.at(0)?.onContext?.();
	expect(menu.open).toHaveBeenLastCalledWith(
		expect.objectContaining({ id: 1 }),
	);
	expect(client.setFavourite).not.toHaveBeenCalled();
	const iconClick = vi
		.mocked(Frame.prototype.onClick)
		.mock.calls.find(
			(_call, index) =>
				vi.mocked(Frame.prototype.onClick).mock.contexts.at(index)?.id ===
				"mounts-icon-0",
		)
		?.at(0);
	iconClick?.("RightButton");
	expect(client.summon).toHaveBeenCalledTimes(2);
	panel.onUnmount();
	nodes.at(0)?.onInteract();
	expect(client.summon).toHaveBeenCalledTimes(2);
});

it("optimistically changes both favourite copies without reloading, including during a 20-mount preview", () => {
	const { panel, parent, client, flush } = setup();
	panel.onMount(parent);
	const load = vi.mocked(client.load).mock.calls.at(-1);
	const mounts = Array.from({ length: 45 }, (_, i) => mount(i + 1));
	load?.[0](mounts.slice(0, 20), { collected: 20, total: 20 }, false);
	flush();
	const nav = new NavigationManager(createTestEventBus());
	nav.registerGrid(panel.id, () => panel.getNavGrid());
	nav.setActiveGrid(panel.id);
	nav.refreshGrid(panel.id, "mount-2");
	panel.setNavigationChanged((focusId) => nav.refreshGrid(panel.id, focusId));
	panel.toggleFavourite(1);
	flush();
	expect(nav.focusedId).toBe("mount-2");
	expect(client.setFavourite).toHaveBeenCalledWith(
		1,
		true,
		expect.any(Function),
	);
	expect(client.load).toHaveBeenCalledOnce();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-favourite-1"),
	).toBe(true);
	// The favourite event must not cancel the ongoing scan or reset to its preview.
	panel.onJournalSearchUpdated();
	panel.onJournalSearchUpdated();
	load?.[0](mounts, { collected: 45, total: 100 });
	flush();
	expect(client.load).toHaveBeenCalledOnce();
	expect(client.getFavourite).toHaveBeenCalledExactlyOnceWith(1);
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => /^mount-\d+$/.test(node.navId)),
	).toHaveLength(45);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-favourite-1"),
	).toBe(true);
	expect(nav.focusedId).toBe("mount-2");
	nav.destroy();
});

it("rolls back rejected favourite requests and reconciles server disagreement using only the changed ID", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	publish([mount(1)]);
	vi.mocked(client.setFavourite).mockImplementationOnce((_id, _value, done) =>
		done(false),
	);
	panel.toggleFavourite(1);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-favourite-1"),
	).toBe(false);
	panel.toggleFavourite(1);
	flush();
	vi.mocked(client.getFavourite).mockReturnValue(false);
	panel.onJournalSearchUpdated();
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId === "mount-favourite-1"),
	).toBe(false);
	expect(client.load).toHaveBeenCalledOnce();
});

it("keeps a live cache subscription across journal event bursts", () => {
	const { panel, parent, client, publish, flush } = setup();
	panel.onMount(parent);
	for (let i = 0; i < 10; i++) panel.onJournalSearchUpdated();
	expect(client.load).toHaveBeenCalledOnce();
	publish([mount(1)]);
	expect(client.load).toHaveBeenCalledOnce();
	publish([mount(1)]);
	for (let i = 0; i < 10; i++) panel.onJournalSearchUpdated();
	flush();
	expect(client.load).toHaveBeenCalledOnce();
});

it("keeps a first page usable, displays bottom progress, rejects stale loads and reuses completed controls", () => {
	const { panel, parent, client, pending, flush, publish, cancel } = setup();
	panel.onMount(parent);
	const initial = vi.mocked(client.load).mock.calls.at(-1);
	initial?.[1]?.(20, 40);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		70,
		4,
		"TOPLEFT",
		expect.anything(),
	);
	initial?.[0]([mount(1)], { collected: 1, total: 1 }, false);
	flush();
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1")
		?.onAlternate?.();
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
	expect(client.load).toHaveBeenCalledTimes(3);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1")
		?.onAlternate?.();
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
	expect(reused).toEqual(icons.slice(1, 3));
	expect(
		vi
			.mocked(Frame.prototype.hide)
			.mock.contexts.some((frame) => frame.id === "mounts-icon-0"),
	).toBe(true);
	expect(
		panel
			.getNavGrid()
			.flat()
			.some((node) => node.navId.startsWith("mount-favourite-")),
	).toBe(false);
});

it("preserves search, filters, equipment and extra actions in a 70px footer", () => {
	vi.useFakeTimers();
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
	vi.advanceTimersByTime(300);
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

it("only enters the search box after A, and clears text focus on blur and reopen", () => {
	const { panel, parent, publish } = setup();
	panel.onMount(parent);
	publish([mount(1)]);
	const search = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mounts-search");
	search?.onFocus();
	expect(Frame.prototype.focusInput).not.toHaveBeenCalled();
	search?.onInteract();
	expect(Frame.prototype.focusInput).toHaveBeenCalledOnce();
	panel.refresh();
	expect(
		panel
			.getNavGrid()
			.flat()
			.find((node) => node.navId === "mounts-search"),
	).toBe(search);
	search?.onBlur();
	expect(Frame.prototype.blurInput).toHaveBeenCalled();
	panel.onUnmount();
	vi.mocked(Frame.prototype.focusInput).mockClear();
	panel.onMount(parent);
	expect(Frame.prototype.focusInput).not.toHaveBeenCalled();
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
