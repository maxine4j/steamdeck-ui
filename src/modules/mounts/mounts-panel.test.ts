import { expect, it, vi } from "vitest";
import type { IMountsClient } from "../../clients/mounts-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { MountsPanel } from "./mounts-panel";

const { frames } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			setIcon: ReturnType<typeof vi.fn>;
			setLabel: ReturnType<typeof vi.fn>;
			setSpell: ReturnType<typeof vi.fn>;
			click: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
			onClick: ReturnType<typeof vi.fn>;
			onDragStart: ReturnType<typeof vi.fn>;
			configureInput: ReturnType<typeof vi.fn>;
			inset: ReturnType<typeof vi.fn>;
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			frames.set(id, this);
		}
		layout = vi.fn();
		setIcon = vi.fn();
		setLabel = vi.fn();
		setSpell = vi.fn();
		click = vi.fn();
		destroy = vi.fn();
		onReceiveDrag = vi.fn();
		onClick = vi.fn();
		onDragStart = vi.fn();
		configureInput = vi.fn();
		inset = vi.fn();
		setParent = vi.fn();
		fill = vi.fn();
		setBlackBackground = vi.fn();
		setColor = vi.fn();
		setTooltip = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		focusInput = vi.fn();
	},
}));

it("makes the first page usable while loading, and reloads a cancelled preview", () => {
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
	const cancel = vi.fn();
	const client: IMountsClient = {
		load: vi.fn(() => cancel),
		getMounts: vi.fn(() => []),
		getCount: vi.fn(() => ({ collected: 0, total: 0 })),
		search: vi.fn(),
		getFilters: () => [],
		toggleFilter: vi.fn(),
		toggleFavourite: vi.fn(),
		getEquipment: () => ({ icon: 1, label: "Equipment" }),
		applyEquipment: vi.fn(),
		getUtilitySpells: () => ({ favourite: 150544, flight: 460002 }),
		summon: vi.fn(),
		pickupRandom: vi.fn(),
	};
	const mounts = Array.from({ length: 45 }, (_, index) => ({
		id: index + 1,
		index: index + 1,
		name: `Mount ${index + 1}`,
		spell: 1,
		icon: 2,
		collected: true,
		usable: true,
		favourite: false,
	}));
	const pool = {} as IFramePoolManager;
	const panel = new MountsPanel(pool, client, vi.fn(), scheduler);
	const parent = new Frame("parent", pool);
	panel.onMount(parent);
	const firstLoad = vi.mocked(client.load).mock.calls.at(-1);
	if (!firstLoad) throw new Error("Expected initial load");
	const [done, preview] = firstLoad;
	preview?.(mounts.slice(0, 20));
	flush();
	const nav = panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-1");
	expect(nav).toBeDefined();
	nav?.onInteract();
	expect(client.summon).toHaveBeenCalledExactlyOnceWith(1);
	expect(
		frames
			.get("mounts-root")
			?.setLabel.mock.calls.filter((call) => call.at(0) === "loading")
			.at(-1)
			?.at(1),
	).toBe("Loading mounts...");
	panel.onUnmount();
	expect(cancel).toHaveBeenCalledOnce();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	// A callback from the cancelled load cannot replace the new load's rows/count.
	done(mounts, { collected: 99, total: 99 });
	const currentLoad = vi.mocked(client.load).mock.calls.at(-1);
	if (!currentLoad) throw new Error("Expected reload");
	const [currentDone, currentPreview] = currentLoad;
	currentPreview?.(mounts.slice(0, 20));
	flush();
	currentDone(mounts, { collected: 45, total: 100 });
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => /^mount-\d+$/.test(node.navId)),
	).toHaveLength(20);
	flush();
	expect(
		panel
			.getNavGrid()
			.flat()
			.filter((node) => /^mount-\d+$/.test(node.navId)),
	).toHaveLength(45);
	expect(frames.get("mounts-root")?.setLabel).not.toHaveBeenCalledWith(
		"count",
		"99 / 99",
		"TOPLEFT",
		16,
		-44,
		14,
	);
	expect(frames.get("mounts-root")?.setLabel).toHaveBeenCalledWith(
		"count",
		"45 / 100",
		"TOPLEFT",
		16,
		-44,
		14,
	);
	expect(
		frames
			.get("mounts-root")
			?.setLabel.mock.calls.filter((call) => call.at(0) === "loading")
			.at(-1)
			?.at(1),
	).toBe("");
	panel.onUnmount();
	panel.onMount(parent);
	expect(client.load).toHaveBeenCalledTimes(2);
	panel.destroy();
});

it("renders icons, the unfiltered counter and footer, routes search/favourites and reuses controls", () => {
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
	const client: IMountsClient = {
		load: vi.fn((done) =>
			scheduler.nextFrame(() => done(client.getMounts(), client.getCount())),
		),
		getMounts: vi.fn(() => [
			{
				id: 42,
				index: 1,
				name: "Horse",
				spell: 123,
				icon: 456,
				collected: true,
				usable: true,
				favourite: true,
			},
			{
				id: 43,
				index: 2,
				name: "Unavailable",
				spell: 124,
				icon: 456,
				collected: true,
				usable: false,
				favourite: false,
			},
			{
				id: 44,
				index: 3,
				name: "Uncollected",
				spell: 125,
				icon: 456,
				collected: false,
				usable: true,
				favourite: false,
			},
		]),
		getCount: vi.fn(() => ({ collected: 10, total: 50 })),
		search: vi.fn(),
		getFilters: () => [
			{ id: "collection:1", label: "Collected", checked: true },
		],
		toggleFilter: vi.fn(),
		toggleFavourite: vi.fn(),
		getEquipment: () => ({ icon: 789, label: "Equipment", link: "item:1" }),
		applyEquipment: vi.fn(),
		getUtilitySpells: () => ({ favourite: 150544, flight: 460002 }),
		summon: vi.fn(),
		pickupRandom: vi.fn(),
	};
	const pool = {} as IFramePoolManager;
	const panel = new MountsPanel(pool, client, vi.fn(), scheduler);
	const parent = new Frame("parent", pool);
	panel.refresh();
	panel.refresh();
	expect(client.getMounts).not.toHaveBeenCalled();
	panel.onMount(parent);
	expect(client.getMounts).not.toHaveBeenCalled();
	panel.refresh();
	panel.refresh();
	flush();
	expect(client.getMounts).toHaveBeenCalledOnce();
	expect(frames.get("mounts-root")?.setLabel).toHaveBeenCalledWith(
		"count",
		"10 / 50",
		"TOPLEFT",
		16,
		-44,
		14,
	);
	expect(frames.get("mounts-icon-0")?.setIcon).toHaveBeenCalledWith(456);
	expect(frames.get("mounts-row-0")?.setLabel.mock.calls.at(0)?.at(1)).toBe(
		"Horse",
	);
	const clickMount = frames
		.get("mounts-row-0")
		?.onClick.mock.calls.at(-1)
		?.at(0) as (button: string) => void;
	clickMount("LeftButton");
	clickMount("RightButton");
	for (const index of [1, 2]) {
		const click = frames
			.get(`mounts-row-${index}`)
			?.onClick.mock.calls.at(-1)
			?.at(0) as (button: string) => void;
		click("LeftButton");
	}
	expect(client.summon).toHaveBeenCalledExactlyOnceWith(42);
	expect(frames.get("mounts-scroll")?.inset).toHaveBeenCalledWith(
		expect.anything(),
		12,
		112,
		12,
		116,
	);
	expect(frames.get("mounts-equipment")?.setIcon).toHaveBeenCalledWith(789);
	const random = frames.get("mounts-random");
	const dragRandom = random?.onDragStart.mock.calls.at(-1)?.at(0) as () => void;
	dragRandom();
	expect(client.pickupRandom).toHaveBeenCalledOnce();
	const clickRandom = random?.onClick.mock.calls.at(-1)?.at(0) as (
		button: string,
	) => void;
	clickRandom("LeftButton");
	expect(client.summon).toHaveBeenLastCalledWith(0);
	expect(frames.get("mounts-flight")?.setSpell).toHaveBeenCalledWith(460002);
	const count = frames.size;
	const search = frames
		.get("mounts-search")
		?.configureInput.mock.calls.at(0)
		?.at(0) as (text: string) => void;
	search("horse");
	flush();
	expect(client.search).toHaveBeenCalledWith("horse");
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mount-42-favourite")
		?.onInteract();
	flush();
	expect(client.toggleFavourite).toHaveBeenCalledWith(42);
	panel
		.getNavGrid()
		.flat()
		.find((node) => node.navId === "mounts-equipment")
		?.onInteract();
	expect(frames.get("mounts-equipment")?.click).toHaveBeenCalledOnce();
	const equipmentClick = frames
		.get("mounts-equipment")
		?.onClick.mock.calls.at(0)
		?.at(0) as () => void;
	equipmentClick();
	flush();
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
	flush();
	expect(client.toggleFilter).toHaveBeenCalledWith("collection:1");
	panel.onUnmount();
	vi.mocked(client.getMounts).mockClear();
	vi.mocked(client.getCount).mockClear();
	clickMount("LeftButton");
	dragRandom();
	expect(client.summon).toHaveBeenCalledTimes(2);
	expect(client.pickupRandom).toHaveBeenCalledOnce();
	expect(panel.getNavGrid()).toEqual([]);
	search("hidden");
	expect(client.search).toHaveBeenCalledTimes(1);
	panel.onMount(parent);
	flush();
	expect(client.getMounts).not.toHaveBeenCalled();
	expect(client.getCount).not.toHaveBeenCalled();
	panel.refresh();
	flush();
	expect(client.getMounts).toHaveBeenCalledOnce();
	// The dropdown's first opening acquires its controls once.
	expect(frames.size).toBeGreaterThan(count);
	const afterDropdown = frames.size;
	panel.onUnmount();
	panel.refresh();
	panel.refresh();
	expect(client.getMounts).toHaveBeenCalledOnce();
	panel.onMount(parent);
	flush();
	expect(client.getMounts).toHaveBeenCalledTimes(2);
	expect(frames.size).toBe(afterDropdown);
	panel.refresh();
	panel.onUnmount();
	flush();
	expect(client.getMounts).toHaveBeenCalledTimes(2);
	panel.onMount(parent);
	flush();
	expect(client.getMounts).toHaveBeenCalledTimes(3);
	panel.destroy();
	expect(frames.get("mounts-search")?.destroy).toHaveBeenCalledOnce();
});
