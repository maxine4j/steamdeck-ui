import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { IFramePoolManager } from "../frame-pool-manager";
import { NavigationManager } from "../navigation/navigation-manager";
import { Frame } from "./frame";
import { ScrollList } from "./scroll-list";

it.each([12, 16, 20, 30])(
	"keeps the scrollbar 11px from the panel edge with %ipx content padding",
	(padding) => {
		const pool = {} as IFramePoolManager;
		const list = new ScrollList("edge", pool, "", vi.fn(), { padding });
		list.mount(new Frame("parent", pool));
		expect(frames.get("edge-scroll")?.inset).toHaveBeenCalledWith(
			expect.anything(),
			padding,
			40 + padding,
			8,
			padding,
		);
	},
);

it("moves the viewport edge outwards while retaining the content gutter", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("gutter", pool, "", vi.fn(), {
		width: 448,
		padding: 30,
		viewportRight: 10,
	});
	list.setRows([{ id: "row", label: "Row", activate: vi.fn() }]);
	list.mount(new Frame("parent", pool));
	expect(frames.get("gutter-scroll")?.inset).toHaveBeenCalledWith(
		expect.anything(),
		30,
		70,
		10,
		30,
	);
	expect(frames.get("gutter-content")?.layout).toHaveBeenCalledWith(
		388,
		52,
		"TOPLEFT",
		expect.anything(),
	);
});

it("contains each row group in its own artwork tile and reuses the containers", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("groups", pool, "", vi.fn());
	const one = {
		id: "one",
		texture: "first-raid",
		cover: { width: 330, height: 256, coords: [0, 330 / 512, 0, 1] as const },
	};
	const two = { id: "two", texture: "second-raid" };
	list.setRows([
		{
			id: "heading",
			label: "One",
			heading: true,
			group: one,
			activate: vi.fn(),
		},
		{ id: "wing", label: "Wing", height: 60, group: one, activate: vi.fn() },
		{
			id: "second",
			label: "Two",
			heading: true,
			marginTop: 16,
			group: two,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	expect(
		frames.get("groups-group-0")?.setCoverTextureBackground,
	).toHaveBeenCalledWith("first-raid", one.cover);
	expect(frames.get("groups-group-0")?.layout).toHaveBeenCalledWith(
		456,
		92,
		"TOPLEFT",
		expect.anything(),
		0,
		-0,
	);
	expect(frames.get("groups-row-1")?.setParent).toHaveBeenCalledWith(
		frames.get("groups-group-0"),
	);
	expect(
		frames.get("groups-group-1")?.setTextureBackground,
	).toHaveBeenCalledWith("second-raid", [0, 1, 0, 1]);
	list.setRows([{ id: "plain", label: "Plain", activate: vi.fn() }]);
	expect(frames.get("groups-group-0")?.hide).toHaveBeenCalled();
	expect(frames.get("groups-group-1")?.hide).toHaveBeenCalled();
	expect(frames.get("groups-row-0")?.setParent).toHaveBeenLastCalledWith(
		frames.get("groups-content"),
	);
});

it("renders textured rows with masked portrait rings and clears them when reusing a row", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("portrait-row", pool, "", vi.fn(), {
		centerLabelsVertically: true,
	});
	const artwork = { file: "menu", coords: [0.1, 0.9, 0.2, 0.8] as const };
	list.setRows([
		{
			id: "category",
			label: "Category",
			height: 80,
			icon: "portrait",
			iconSize: 66,
			iconRing: { atlas: "ring", size: 95, maskAtlas: "circle" },
			backgroundTexture: artwork,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	expect(
		frames.get("portrait-row-row-0")?.setTextureBackground,
	).toHaveBeenCalledWith("menu", artwork.coords);
	expect(frames.get("portrait-row-icon-0")?.setIconRing).toHaveBeenCalledWith({
		atlas: "ring",
		size: 95,
		maskAtlas: "circle",
	});
	const labelX = frames
		.get("portrait-row-row-0")
		?.setLabel.mock.calls.find((call) => call.at(0) === "label")
		?.at(3) as number;
	expect(labelX).toBeGreaterThan(6 + 66 / 2 + 95 / 2);
	list.setRows([
		{ id: "plain", label: "Plain", icon: "square", activate: vi.fn() },
	]);
	expect(
		frames.get("portrait-row-icon-0")?.setIconRing,
	).toHaveBeenLastCalledWith(undefined);
});

it("centers tile icons beside centered labels and insets icons and actions by the content padding", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("padded-spec", pool, "", vi.fn(), {
		centerLabelsVertically: true,
		contentPadding: { horizontal: 24, vertical: 10 },
	});
	list.setRows([
		{
			id: "spec",
			label: "Arms",
			icon: 10,
			height: 64,
			secondary: {
				label: "Switch Spec",
				width: 110,
				height: 32,
				onlyAction: true,
				activate: vi.fn(),
			},
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("padded-parent", pool));
	expect(frames.get("padded-spec-icon-0")?.layout).toHaveBeenLastCalledWith(
		36,
		36,
		"LEFT",
		expect.anything(),
		24,
		0,
	);
	expect(
		frames.get("padded-spec-secondary-0")?.layout,
	).toHaveBeenLastCalledWith(110, 32, "RIGHT", expect.anything(), -24, 0);
});

it("left-aligns and vertically centers one or two label lines and removes empty action tooltips", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("stacked-labels", pool, "", vi.fn(), {
		buttonWidth: 420,
		centerLabelsVertically: true,
		contentPadding: { horizontal: 16, vertical: 10 },
	});
	const action = {
		label: "Queue",
		width: 110,
		height: 32,
		onlyAction: true,
		activate: vi.fn(),
	};
	list.setRows([
		{
			id: "queue",
			label: "Random Timewalking Dungeon",
			detail: "(Mists of Pandaria)",
			height: 60,
			secondary: { ...action, tooltip: "Boss names" },
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	const tile = frames.get("stacked-labels-row-0");
	expect(tile?.setLabel).toHaveBeenCalledWith(
		"label",
		"Random Timewalking Dungeon",
		"LEFT",
		16,
		8,
		14,
		262,
	);
	expect(tile?.setLabel).toHaveBeenCalledWith(
		"detail",
		"(Mists of Pandaria)",
		"LEFT",
		16,
		-9,
		12,
		262,
	);
	list.setRows([
		{
			id: "queue",
			label: "Wing • 1/3",
			height: 60,
			secondary: action,
			activate: vi.fn(),
		},
	]);
	expect(tile?.setLabel).toHaveBeenCalledWith(
		"label",
		"Wing • 1/3",
		"LEFT",
		16,
		0,
		14,
		262,
	);
	expect(
		frames.get("stacked-labels-secondary-0")?.clearTooltip,
	).toHaveBeenCalled();
});

it("uses animated navigation outlines for rows with animated artwork and skips arrival on refresh", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("arrival-row", pool, "", vi.fn());
	list.setRows([
		{
			id: "queued",
			label: "Queued",
			activate: vi.fn(),
			animatedIcon: {
				atlas: "eye",
				rows: 1,
				columns: 2,
				frames: 2,
				duration: 1,
			},
		},
	]);
	list.mount(new Frame("arrival-parent", pool));
	const node = list.getNavGrid().at(0)?.at(0);
	node?.onFocus();
	expect(frames.get("arrival-row-row-0")?.setFocused).toHaveBeenLastCalledWith(
		true,
	);
	node?.onFocus(true);
	expect(frames.get("arrival-row-row-0")?.setFocused).toHaveBeenLastCalledWith(
		true,
		false,
		true,
	);
});

it("preserves the existing secondary button click behavior for favourite controls", () => {
	const pool = {} as IFramePoolManager;
	const favourite = vi.fn();
	const list = new ScrollList("favourite-click", pool, "", vi.fn());
	list.setRows([
		{
			id: "mount",
			label: "Mount",
			secondary: { label: "☆", activate: favourite },
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	frames.get("favourite-click-secondary-0")?.onClick.mock.lastCall?.at(0)(
		"RightButton",
	);
	expect(favourite).toHaveBeenCalledOnce();
});

it("makes the inset action button the only interactive part of a wide tile", () => {
	const pool = {} as IFramePoolManager;
	const queue = vi.fn();
	const body = vi.fn();
	const list = new ScrollList("inset-action", pool, "", vi.fn(), {
		buttonWidth: 420,
		centerText: true,
		contentPadding: { horizontal: 16, vertical: 10 },
	});
	const tile = {
		id: "wing",
		label: "Wing",
		detail: "",
		height: 60,
		backgroundAtlas: "ui-journeys-renown-button",
		backgroundSlice: 16,
		secondary: {
			label: "Queue",
			width: 110,
			height: 32,
			onlyAction: true,
			tooltip: "Enter Queue?",
			activate: queue,
		},
		activate: body,
	};
	list.setRows([tile]);
	list.mount(new Frame("parent", pool));
	const button = frames.get("inset-action-secondary-0");
	expect(button?.layout).toHaveBeenLastCalledWith(
		110,
		32,
		"RIGHT",
		expect.anything(),
		-16,
		0,
	);
	expect(button?.setButtonBackground).toHaveBeenCalled();
	expect(
		frames.get("inset-action-row-0")?.setAtlasBackground,
	).toHaveBeenLastCalledWith("ui-journeys-renown-button", undefined, 16);
	expect(button?.setLabel).toHaveBeenLastCalledWith("label", "Queue");
	expect(frames.get("inset-action-row-0")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Wing",
		"TOP",
		-63,
		-10,
		14,
		262,
	);
	frames.get("inset-action-row-0")?.onClick.mock.lastCall?.at(0)("LeftButton");
	expect(body).not.toHaveBeenCalled();
	expect(
		list
			.getNavGrid()
			.flat()
			.map((node) => node.navId),
	).toEqual(["wing"]);
	list.getNavGrid().flat().at(0)?.onInteract();
	expect(queue).toHaveBeenCalledOnce();
	list.setRows([
		{
			...tile,
			detail: "In Queue",
			animatedIconOnDetail: true,
			animatedIcon: {
				atlas: "eye",
				rows: 8,
				columns: 11,
				frames: 80,
				duration: 2,
			},
			backgroundTint: [0.2, 0.8, 0.3],
			secondary: { ...tile.secondary, label: "Leave Queue" },
		},
	]);
	expect(button?.setLabel).toHaveBeenLastCalledWith("label", "Leave Queue");
	expect(
		frames.get("inset-action-animation-0")?.layout,
	).toHaveBeenLastCalledWith(20, 20, "BOTTOMRIGHT", expect.anything(), -134, 8);
	const nav = list.getNavGrid().flat().at(0);
	nav?.onFocus();
	expect(button?.setFocused).toHaveBeenLastCalledWith(true);
	expect(button?.showTooltip).toHaveBeenLastCalledWith({
		text: "Enter Queue?",
	});
	nav?.onBlur();
	expect(button?.hideTooltip).toHaveBeenCalled();
	list.setRows([{ ...tile, enabled: false }]);
	nav?.onInteract();
	expect(queue).toHaveBeenCalledOnce();
	expect(list.getNavGrid()).toEqual([]);
	list.setRows([{ id: "plain", label: "Plain", activate: body }]);
	expect(button?.hide).toHaveBeenCalled();
	list.getNavGrid().flat().at(0)?.onInteract();
	expect(body).toHaveBeenCalledOnce();
});

it("shows a second-line prompt on mouse hover or controller focus and retains queued status on line two", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("queue-tile", pool, "", vi.fn(), {
		centerText: true,
		buttonWidth: 280,
	});
	const tile = {
		id: "wing",
		label: "Wing one",
		height: 60,
		hoverDetail: "Enter Queue?",
		backgroundAtlas: "ui-journeys-renown-button",
		activate: vi.fn(),
	};
	list.setRows([tile]);
	list.mount(new Frame("parent", pool));
	const frame = frames.get("queue-tile-row-0");
	expect(frame?.setLabel).toHaveBeenCalledWith(
		"label",
		"Wing one",
		"TOP",
		0,
		-6,
		14,
		264,
	);
	const hover = frame?.setTooltip.mock.lastCall?.at(3) as
		| ((hovered: boolean) => void)
		| undefined;
	expect(hover).toBeTypeOf("function");
	hover?.(true);
	expect(frame?.setLabel).toHaveBeenLastCalledWith(
		"detail",
		"Enter Queue?",
		"BOTTOM",
		0,
		6,
		12,
		264,
	);
	hover?.(false);
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("");
	const nav = list.getNavGrid().at(0)?.at(0);
	nav?.onFocus();
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("Enter Queue?");
	list.setRows([
		{
			...tile,
			detail: "In Queue",
			hoverDetail: "In queue - leave?",
			animatedIconOnDetail: true,
			animatedIcon: {
				atlas: "eye",
				rows: 8,
				columns: 11,
				frames: 80,
				duration: 2,
			},
			backgroundTint: [0.2, 0.8, 0.3],
		},
	]);
	expect(frames.get("queue-tile-animation-0")?.layout).toHaveBeenLastCalledWith(
		20,
		20,
		"BOTTOMRIGHT",
		expect.anything(),
		-8,
		4,
	);
	expect(frame?.setLabel).toHaveBeenCalledWith(
		"label",
		"Wing one",
		"TOP",
		0,
		-6,
		14,
		264,
	);
	nav?.onBlur();
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("In Queue");
	const queuedHover = frame?.setTooltip.mock.lastCall?.at(3) as
		| ((hovered: boolean) => void)
		| undefined;
	queuedHover?.(true);
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("In queue - leave?");
	queuedHover?.(false);
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("In Queue");
	nav?.onFocus();
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("In queue - leave?");
	nav?.onBlur();
	expect(frame?.setAtlasBackground).toHaveBeenLastCalledWith(
		"ui-journeys-renown-button",
		[0.2, 0.8, 0.3],
	);
	list.setRows([{ ...tile, enabled: false }]);
	const disabledHover = frame?.setTooltip.mock.lastCall?.at(3) as
		| ((hovered: boolean) => void)
		| undefined;
	disabledHover?.(true);
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("");
	list.setRows([tile]);
	nav?.onFocus();
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("Enter Queue?");
	list.unmount();
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("");
	hover?.(true);
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("");
	list.mount(new Frame("reopened-parent", pool));
	expect(frame?.setLabel.mock.lastCall?.at(1)).toBe("");
});

it("centers compact buttons and their text while retaining full-width headings", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("compact", pool, "", vi.fn(), {
		buttonWidth: 280,
		centerText: true,
		centerContent: true,
	});
	list.setRows([
		{ id: "heading", label: "Dungeons", heading: true, activate: vi.fn() },
		{ id: "wing", label: "Wing", height: 32, activate: vi.fn() },
	]);
	list.mount(new Frame("parent", pool));
	expect(frames.get("compact-content")?.layout).toHaveBeenCalledWith(
		456,
		68,
		"TOP",
		expect.anything(),
	);
	expect(frames.get("compact-row-0")?.layout).toHaveBeenCalledWith(
		456,
		28,
		"TOPLEFT",
		expect.anything(),
		0,
		-0,
	);
	expect(frames.get("compact-row-1")?.layout).toHaveBeenCalledWith(
		280,
		32,
		"TOPLEFT",
		expect.anything(),
		88,
		-32,
	);
	expect(frames.get("compact-row-1")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Wing",
		"CENTER",
		0,
		0,
		14,
		264,
	);
});

it("uses small category icons and leaves room for their labels", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("small-icons", pool, "", vi.fn());
	list.setRows([
		{
			id: "category",
			label: "Quests",
			icon: 133459,
			iconSize: 20,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	expect(frames.get("small-icons-icon-0")?.layout).toHaveBeenLastCalledWith(
		20,
		20,
		"TOPLEFT",
		expect.anything(),
		6,
		-6,
	);
	expect(frames.get("small-icons-row-0")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Quests",
		"TOPLEFT",
		32,
		-6,
		14,
		416,
	);
});

it("places counts on the right of line two and gives the name the full text width", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("second-line", pool, "", vi.fn(), {
		contentPadding: { horizontal: 18, vertical: 16 },
	});
	list.setRows([
		{
			id: "category",
			label: "Expansion Features",
			icon: 133158,
			iconSize: 20,
			fontSize: 12,
			height: 80,
			trailingLabel: "2/3 67%",
			trailingOnSecondLine: true,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	expect(frames.get("second-line-row-0")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Expansion Features",
		"TOPLEFT",
		46,
		-16,
		12,
		392,
	);
	expect(frames.get("second-line-row-0")?.setLabel).toHaveBeenCalledWith(
		"trailing",
		"2/3 67%",
		"TOPRIGHT",
		-18,
		-36,
		12,
		expect.any(Number),
	);
});

it("shows full reward links on controller focus and hides them on blur", () => {
	const list = new ScrollList(
		"tooltip-list",
		{} as IFramePoolManager,
		"",
		vi.fn(),
	);
	list.setRows([
		{
			id: "sword",
			label: "Sword",
			tooltipContent: "item:456",
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", {} as IFramePoolManager));
	const node = list.getNavGrid().at(0)?.at(0);
	node?.onFocus();
	expect(frames.get("tooltip-list-row-0")?.showTooltip).toHaveBeenCalledWith(
		"item:456",
	);
	node?.onBlur();
	expect(frames.get("tooltip-list-row-0")?.hideTooltip).toHaveBeenCalledOnce();
	node?.onFocus();
	list.setRows([{ id: "close", label: "Close", activate: vi.fn() }]);
	expect(frames.get("tooltip-list-row-0")?.hideTooltip).toHaveBeenCalledTimes(
		2,
	);
});

it("rebuilds layout when an update adds a progress bar to a variable-height row", () => {
	const pending: (() => void)[] = [];
	const list = new ScrollList(
		"changed-layout",
		{} as IFramePoolManager,
		"",
		vi.fn(),
		{
			scheduler: {
				nextFrame: (callback) => {
					pending.push(callback);
					return vi.fn();
				},
			},
		},
	);
	list.setRows([{ id: "row", label: "Row", activate: vi.fn() }]);
	list.mount(new Frame("parent", {} as IFramePoolManager));
	pending.shift()?.();
	list.updateRows([
		{
			id: "row",
			label: "Row",
			progress: { value: 0.5, color: [1, 1, 1] },
			activate: vi.fn(),
		},
	]);
	expect(list.getNavGrid()).toEqual([]);
	while (pending.length) pending.shift()?.();
	expect(frames.get("changed-layout-row-0")?.layout).toHaveBeenLastCalledWith(
		456,
		60,
		"TOPLEFT",
		expect.anything(),
		0,
		-0,
	);
});

it("keeps early navigation and focus active while pending progress updates arrive", () => {
	const pending: (() => void)[] = [];
	const nav = new NavigationManager(createTestEventBus());
	const makeRows = (completed: number) =>
		["quests", "exploration"].map((id) => ({
			id,
			label: id,
			height: 80,
			trailingLabel: `${completed}/10`,
			progress: { value: completed / 10, color: [1, 1, 1] as const },
			activate: vi.fn(),
		}));
	const list = new ScrollList(
		"early-nav",
		{} as IFramePoolManager,
		"",
		vi.fn(),
		{
			columns: 2,
			scheduler: {
				nextFrame: (callback) => {
					let cancelled = false;
					pending.push(() => {
						if (!cancelled) callback();
					});
					return () => {
						cancelled = true;
					};
				},
			},
			onChanged: () => nav.refreshGrid("left"),
		},
	);
	list.setRows(makeRows(0));
	list.mount(new Frame("parent", {} as IFramePoolManager));
	nav.registerGrid("left", () => list.getNavGrid());
	nav.setActiveGrid("left");
	list.updateRows(makeRows(1));
	list.updateRows(makeRows(2));
	pending.shift()?.();
	expect(nav.focusedId).toBe("quests");
	nav.moveRight();
	expect(nav.focusedId).toBe("exploration");
	list.updateRows(makeRows(3));
	expect(nav.focusedId).toBe("exploration");
	expect(list.getNavGrid().flat()).toHaveLength(2);
	while (pending.length) pending.shift()?.();
	expect(nav.focusedId).toBe("exploration");
});

it("supports larger scheduled batches and wrapped labels in narrow two-column tiles", () => {
	const pending: (() => void)[] = [];
	const list = new ScrollList(
		"larger-batch",
		{} as IFramePoolManager,
		"",
		vi.fn(),
		{
			columns: 2,
			batchSize: 30,
			scheduler: {
				nextFrame: (callback) => {
					pending.push(callback);
					return vi.fn();
				},
			},
		},
	);
	list.setRows(
		Array.from({ length: 25 }, (_, i) => ({
			id: `${i}`,
			label: "Expansion Features",
			wrapLabel: true,
			activate: vi.fn(),
		})),
	);
	list.mount(new Frame("parent", {} as IFramePoolManager));
	pending.shift()?.();
	expect(list.getNavGrid().flat()).toHaveLength(25);
	expect(
		frames.get("larger-batch-row-0")?.setLabelWordWrap,
	).toHaveBeenCalledWith("label", true);
});

it("switches between two-column summary navigation and single-column detail navigation", () => {
	const list = new ScrollList(
		"switch-columns",
		{} as IFramePoolManager,
		"",
		vi.fn(),
	);
	list.setRows(
		[1, 2, 3].map((id) => ({ id: `${id}`, label: `${id}`, activate: vi.fn() })),
	);
	list.mount(new Frame("parent", {} as IFramePoolManager));
	list.setColumns(2);
	expect(list.getNavGrid().map((row) => row.map((n) => n.navId))).toEqual([
		["1", "2"],
		["3"],
	]);
	list.setColumns(1);
	expect(list.getNavGrid().map((row) => row.map((n) => n.navId))).toEqual([
		["1"],
		["2"],
		["3"],
	]);
	expect(
		list
			.getNavGrid()
			.flat()
			.map((n) => n.navColumn ?? 0),
	).toEqual([0, 0, 0]);
	list.setRows([
		{
			id: "details",
			label: "Achievement",
			detail: "Long achievement description",
			activate: vi.fn(),
		},
	]);
	expect(
		frames.get("switch-columns-row-0")?.setLabelWordWrap,
	).toHaveBeenLastCalledWith("detail", true);
});

it("keeps first-line labels and counts equally inset from a progress button's edges", () => {
	const list = new ScrollList(
		"padded-category",
		{} as IFramePoolManager,
		"",
		vi.fn(),
		{
			contentPadding: { horizontal: 18, vertical: 16 },
			progressInset: { horizontal: 0, bottom: 12 },
		},
	);
	list.setRows([
		{
			id: "quests",
			label: "Quests",
			trailingLabel: "1 / 2 • 50%",
			trailingOnFirstLine: true,
			height: 67,
			progress: { value: 0.5, color: [1, 1, 1] },
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", {} as IFramePoolManager));
	expect(frames.get("padded-category-row-0")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Quests",
		"TOPLEFT",
		18,
		-16,
		14,
		expect.any(Number),
	);
	expect(frames.get("padded-category-row-0")?.setLabel).toHaveBeenCalledWith(
		"trailing",
		"1 / 2 • 50%",
		"TOPRIGHT",
		-18,
		-16,
		14,
		expect.any(Number),
	);
});

it("aligns optional trailing counts with the first text line", () => {
	const list = new ScrollList(
		"top-count",
		{} as IFramePoolManager,
		"",
		vi.fn(),
	);
	list.setRows([
		{
			id: "category",
			label: "Quests",
			trailingLabel: "1 / 2 • 50%",
			trailingOnFirstLine: true,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", {} as IFramePoolManager));
	expect(frames.get("top-count-row-0")?.setLabel).toHaveBeenCalledWith(
		"trailing",
		"1 / 2 • 50%",
		"TOPRIGHT",
		-8,
		-6,
		14,
		expect.any(Number),
	);
});

it("renders plain rows with transparent backgrounds and no checkboxes", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("plain", pool, "", vi.fn());
	list.setRows([
		{ id: "currency", label: "Marks", background: false, activate: vi.fn() },
	]);
	list.mount(new Frame("plain-parent", pool));
	expect(frames.get("plain-row-0")?.setColor).toHaveBeenLastCalledWith(
		0,
		0,
		0,
		0,
	);
	expect(frames.has("plain-checkbox-0")).toBe(false);
});

it("preserves focused row identity when favourite duplicates are inserted before it", () => {
	const pool = {} as IFramePoolManager;
	const navigation = new NavigationManager(createTestEventBus());
	const list = new ScrollList("favourites-focus", pool, "", vi.fn(), {
		onChanged: (complete) => {
			if (complete) navigation.refreshGrid("currency");
		},
	});
	const row = { id: "currency-42", label: "Marks", activate: vi.fn() };
	list.setRows([{ id: "category", label: "Category", activate: vi.fn() }, row]);
	list.mount(new Frame("favourites-focus-parent", pool));
	navigation.registerGrid("currency", () => list.getNavGrid());
	navigation.setActiveGrid("currency");
	navigation.moveDown();
	expect(navigation.focusedId).toBe("currency-42");
	list.setRows([
		{ id: "favourite-42", label: "Marks", activate: vi.fn() },
		{ id: "category", label: "Category", activate: vi.fn() },
		row,
	]);
	expect(navigation.focusedId).toBe("currency-42");
	list.setRows([{ id: "category", label: "Category", activate: vi.fn() }, row]);
	expect(navigation.focusedId).toBe("currency-42");
});

it("pads button contents and centers single-line labels without crowding icons", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("padding", pool, "Test", vi.fn(), {
		contentPadding: { horizontal: 16, vertical: 10 },
		centerSingleLine: true,
	});
	list.setRows([
		{ id: "single", label: "Single", activate: vi.fn() },
		{
			id: "spec",
			label: "Spec",
			detail: "Active",
			icon: 1,
			height: 64,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("padding-parent", pool));
	expect(frames.get("padding-row-0")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Single",
		"LEFT",
		16,
		0,
		14,
		424,
	);
	expect(frames.get("padding-icon-1")?.layout).toHaveBeenCalledWith(
		36,
		36,
		"TOPLEFT",
		expect.anything(),
		16,
		-10,
	);
	expect(frames.get("padding-row-1")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Spec",
		"TOPLEFT",
		60,
		-10,
		14,
		380,
	);
	expect(frames.get("padding-row-1")?.setLabel).toHaveBeenCalledWith(
		"detail",
		"Active",
		"BOTTOMLEFT",
		60,
		10,
		12,
		380,
	);
});

it("insets textured progress below the text and tints a neutral fill", () => {
	const list = new ScrollList(
		"padded",
		{} as IFramePoolManager,
		"Test",
		vi.fn(),
		{
			edgeProgress: true,
			contentPadding: { horizontal: 16, vertical: 12 },
			progressInset: { horizontal: 16, bottom: 12 },
			progressTextures: {
				fill: "ui-journeys-progressbar-fill",
				track: "ui-journeys-progressbar-BG",
			},
		},
	);
	list.setRows([
		{
			id: "rep",
			label: "Rep",
			detail: "Friendly",
			height: 72,
			indent: 12,
			progress: { value: 0.5, color: [0, 1, 0] },
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("padded-parent", {} as IFramePoolManager));
	expect(
		frames.get("padded-track-0")?.setAtlasBackground,
	).toHaveBeenLastCalledWith("ui-journeys-progressbar-BG");
	expect(
		frames.get("padded-progress-0")?.setAtlasBackground,
	).toHaveBeenLastCalledWith(
		"ui-journeys-progressbar-fill",
		[0, 1, 0],
		undefined,
		true,
	);
	expect(frames.get("padded-row-0")?.setLabel).toHaveBeenCalledWith(
		"label",
		"Rep",
		"TOPLEFT",
		16,
		-12,
		14,
		412,
	);
	expect(frames.get("padded-row-0")?.setLabel).toHaveBeenCalledWith(
		"detail",
		"Friendly",
		"BOTTOMLEFT",
		16,
		24,
		12,
		412,
	);
	expect(frames.get("padded-track-0")?.layout).toHaveBeenLastCalledWith(
		412,
		6,
		"BOTTOMLEFT",
		expect.anything(),
		16,
		12,
	);
	expect(frames.get("padded-progress-0")?.layout).toHaveBeenLastCalledWith(
		206,
		6,
		"BOTTOMLEFT",
		expect.anything(),
		0,
		0,
	);
});

it("preserves a row's atlas artwork across focus and clears it when reused as a heading", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("atlas", pool, "Test", vi.fn());
	list.setRows([
		{
			id: "tile",
			label: "Tile",
			backgroundAtlas: "tile-art",
			backgroundTint: [0.85, 0.95, 1],
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("atlas-parent", pool));
	const row = frames.get("atlas-row-0");
	expect(row?.setAtlasBackground).toHaveBeenLastCalledWith(
		"tile-art",
		[0.85, 0.95, 1],
	);
	const nav = list.getNavGrid().at(0)?.at(0);
	nav?.onFocus();
	nav?.onBlur();
	expect(row?.setAtlasBackground).toHaveBeenLastCalledWith(
		"tile-art",
		[0.85, 0.95, 1],
	);
	expect(row?.setButtonBackground).not.toHaveBeenCalled();
	list.setRows([
		{ id: "heading", label: "Heading", heading: true, activate: vi.fn() },
	]);
	expect(row?.setColor).toHaveBeenLastCalledWith(0, 0, 0, 0);
});

it.each([1, 2])(
	"adds heading margins to %i-column layouts and scrolling",
	(columns) => {
		const pool = {} as IFramePoolManager;
		const list = new ScrollList("heading-margin", pool, "Test", vi.fn(), {
			columns,
			gap: 12,
		});
		list.setRows([
			{ id: "first", label: "First", height: 60, activate: vi.fn() },
			{
				id: "heading",
				label: "Expansion",
				heading: true,
				marginTop: 24,
				activate: vi.fn(),
			},
			{ id: "second", label: "Second", height: 60, activate: vi.fn() },
		]);
		list.mount(new Frame("heading-margin-parent", pool));
		expect(frames.get("heading-margin-row-1")?.layout).toHaveBeenLastCalledWith(
			456,
			28,
			"TOPLEFT",
			expect.anything(),
			0,
			-96,
		);
		list.getNavGrid().at(1)?.at(0)?.onFocus();
		expect(
			frames.get("heading-margin-scroll")?.revealVerticalRange,
		).toHaveBeenLastCalledWith(128, 188, 200);
	},
);

it("lays out two-column tiles with full-width headings and spatial navigation", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("tiles", pool, "Test", vi.fn(), {
		columns: 2,
		gap: 12,
		edgeProgress: true,
	});
	list.setRows([
		{
			id: "heading",
			label: "Expansion",
			heading: true,
			marginBottom: 12,
			activate: vi.fn(),
		},
		...["a", "b", "c"].map((id) => ({
			id,
			label: id,
			height: 60,
			progress: { value: 0.5, color: [0, 1, 0] as const },
			activate: vi.fn(),
		})),
		{ id: "group", label: "Children", heading: true, activate: vi.fn() },
		{ id: "d", label: "D", height: 60, activate: vi.fn() },
	]);
	list.mount(new Frame("tiles-parent", pool));
	expect(list.getNavGrid().map((row) => row.map((node) => node.navId))).toEqual(
		[["a", "b"], ["c"], ["d"]],
	);
	expect(frames.get("tiles-row-1")?.layout).toHaveBeenLastCalledWith(
		222,
		60,
		"TOPLEFT",
		expect.anything(),
		0,
		-44,
	);
	expect(frames.get("tiles-row-2")?.layout).toHaveBeenLastCalledWith(
		222,
		60,
		"TOPLEFT",
		expect.anything(),
		234,
		-44,
	);
	expect(frames.get("tiles-row-4")?.layout).toHaveBeenLastCalledWith(
		456,
		28,
		"TOPLEFT",
		expect.anything(),
		0,
		-188,
	);
	expect(frames.get("tiles-track-1")?.layout).toHaveBeenLastCalledWith(
		222,
		6,
		"BOTTOMLEFT",
		expect.anything(),
		0,
		0,
	);
	list.getNavGrid().at(1)?.at(0)?.onFocus();
	expect(
		frames.get("tiles-scroll")?.revealVerticalRange,
	).toHaveBeenLastCalledWith(116, 176, 292);
	const node = list.getNavGrid().at(0)?.at(0);
	list.setWidth(600);
	expect(list.getNavGrid().at(0)?.at(0)).toBe(node);
	expect(frames.get("tiles-row-1")?.setLabelWordWrap).toHaveBeenCalledWith(
		"label",
		false,
	);
	expect(frames.get("tiles-row-1")?.setLabelWordWrap).toHaveBeenCalledWith(
		"detail",
		false,
	);
});

it("mixes full-width action tiles with a two-column grid and matching navigation", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("mixed", pool, "", vi.fn(), { columns: 2 });
	const switchSpec = vi.fn();
	list.setRows([
		{
			id: "spec",
			label: "Spec",
			fullWidth: true,
			height: 64,
			secondary: {
				label: "Switch Spec",
				onlyAction: true,
				activate: switchSpec,
			},
			activate: vi.fn(),
		},
		...["a", "b", "c"].map((id) => ({ id, label: id, activate: vi.fn() })),
		{ id: "spec2", label: "Spec 2", fullWidth: true, activate: vi.fn() },
	]);
	list.mount(new Frame("mixed-parent", pool));
	expect(frames.get("mixed-row-0")?.layout).toHaveBeenLastCalledWith(
		456,
		64,
		"TOPLEFT",
		expect.anything(),
		0,
		-0,
	);
	expect(frames.get("mixed-row-4")?.layout).toHaveBeenLastCalledWith(
		456,
		48,
		"TOPLEFT",
		expect.anything(),
		0,
		-172,
	);
	expect(
		list.getNavGrid().map((line) => line.map((node) => node.navId)),
	).toEqual([["spec"], ["a", "b"], ["c"], ["spec2"]]);
	list.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(switchSpec).toHaveBeenCalledOnce();
});

it("resizes existing rows without replacing their controls", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("resize", pool, "Test", vi.fn());
	list.setRows([{ id: "row", label: "Row", activate: vi.fn() }]);
	list.mount(new Frame("resize-parent", pool));
	const node = list.getNavGrid().at(0)?.at(0);
	list.setWidth(600);
	expect(frames.get("resize-row-0")?.layout).toHaveBeenLastCalledWith(
		576,
		48,
		"TOPLEFT",
		expect.anything(),
		0,
		-0,
	);
	expect(list.getNavGrid().at(0)?.at(0)).toBe(node);
});

it("routes context actions to the current row and ignores hidden lists", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("context", pool, "Test", vi.fn());
	const context = vi.fn();
	list.setRows([
		{ id: "currency", label: "Currency", activate: vi.fn(), context },
	]);
	list.mount(new Frame("context-parent", pool));
	const node = list.getNavGrid().at(0)?.at(0);
	node?.onContext?.();
	expect(context).toHaveBeenCalledOnce();
	list.unmount();
	node?.onContext?.();
	expect(context).toHaveBeenCalledOnce();
});

const { frames } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			setColor: ReturnType<typeof vi.fn>;
			hide: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
			show: ReturnType<typeof vi.fn>;
			revealVerticalRange: ReturnType<typeof vi.fn>;
			setOpacity: ReturnType<typeof vi.fn>;
			setAnimatedAtlas: ReturnType<typeof vi.fn>;
			setBorder: ReturnType<typeof vi.fn>;
			show: ReturnType<typeof vi.fn>;
			onClick: ReturnType<typeof vi.fn>;
			setTooltip: ReturnType<typeof vi.fn>;
			clearTooltip: ReturnType<typeof vi.fn>;
			setFocused: ReturnType<typeof vi.fn>;
			showTooltip: ReturnType<typeof vi.fn>;
			hideTooltip: ReturnType<typeof vi.fn>;
			setLabelWordWrap: ReturnType<typeof vi.fn>;
		}
	>(),
}));

it("does not create a window close button", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("embedded", pool, "", vi.fn());
	list.mount(new Frame("embedded-parent", pool));
	expect(frames.has("embedded-close")).toBe(false);
});

it("reveals a selected row by its logical id", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("selection", pool, "", vi.fn());
	list.setRows([
		{ id: "one", label: "One", activate: vi.fn() },
		{ id: "two", label: "Two", activate: vi.fn() },
	]);
	list.mount(new Frame("selection-parent", pool));
	list.revealRow("two");
	expect(
		frames.get("selection-scroll")?.revealVerticalRange,
	).toHaveBeenLastCalledWith(52, 100, 104);
});
vi.mock("./frame", () => ({
	Frame: class {
		constructor(id: string) {
			frames.set(id, this);
		}
		layout = vi.fn();
		setNavigationFocus = vi.fn();
		setAnimatedAtlas = vi.fn();
		layoutVerticallyCentered = vi.fn();
		onSizeChanged = vi.fn();
		setColor = vi.fn();
		setFocused = vi.fn();
		setOpacity = vi.fn();
		setBorder = vi.fn();
		resetScroll = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		setParent = vi.fn();
		show = vi.fn();
		setLabel = vi.fn();
		setLabelWordWrap = vi.fn();
		setIcon = vi.fn();
		setIconRing = vi.fn();
		setTextureBackground = vi.fn();
		setCoverTextureBackground = vi.fn();
		setTooltip = vi.fn();
		clearTooltip = vi.fn();
		setHoverTooltip = vi.fn();
		showTooltip = vi.fn();
		hideTooltip = vi.fn();
		onClick = vi.fn();
		inset = vi.fn();
		fill = vi.fn();
		setWindowBackground = vi.fn();
		setButtonBackground = vi.fn();
		setAtlasBackground = vi.fn();
		setInsetBackground = vi.fn();
		setCloseButtonBackground = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		scrollToEdge = vi.fn();
		revealVerticalRange = vi.fn();
	},
}));

it("renders a trailing animation, preserves row color on focus and stops it on reuse", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("animated", pool, "Test", vi.fn());
	const animation = {
		atlas: "atlas",
		rows: 8,
		columns: 11,
		frames: 80,
		duration: 2,
	};
	list.setRows([
		{
			id: "queue",
			label: "Queue",
			background: [0.05, 0.25, 0.5],
			animatedIcon: animation,
			activate: vi.fn(),
		},
	]);
	list.mount(new Frame("parent", pool));
	expect(
		frames.get("animated-animation-0")?.setAnimatedAtlas,
	).toHaveBeenCalledWith(animation);
	list.getNavGrid().at(0)?.at(0)?.onFocus();
	expect(frames.get("animated-row-0")?.setColor).toHaveBeenLastCalledWith(
		0.05,
		0.25,
		0.5,
	);
	list.setRows([{ id: "other", label: "Other", activate: vi.fn() }]);
	expect(frames.get("animated-animation-0")?.hide).toHaveBeenCalled();
	expect(frames.get("animated-row-0")?.setBorder).toHaveBeenLastCalledWith([
		0, 0, 0, 0,
	]);
});

it.each([1, 2])(
	"preserves checked tile artwork and dims only a disabled secondary action (%i columns)",
	(columns) => {
		const pool = {} as IFramePoolManager;
		const list = new ScrollList("active-tile", pool, "", vi.fn(), { columns });
		const activate = vi.fn();
		const tile = {
			id: "active",
			label: "Active",
			checked: true,
			checkAtlas: "groupfinder-icon-greencheckmark",
			checkPlacement: "secondary" as const,
			backgroundAtlas: "ui-journeys-renown-button",
			secondary: {
				label: "Switch Spec",
				onlyAction: true,
				enabled: false,
				activate,
			},
			activate: vi.fn(),
		};
		list.setRows([tile]);
		list.mount(new Frame("parent", pool));
		expect(
			frames.get("active-tile-row-0")?.setAtlasBackground,
		).toHaveBeenLastCalledWith(tile.backgroundAtlas);
		expect(
			frames.get("active-tile-check-0")?.setAtlasBackground,
		).toHaveBeenLastCalledWith(tile.checkAtlas);
		expect(
			frames.get("active-tile-checkbox-0")?.layout,
		).toHaveBeenLastCalledWith(
			21,
			20.3,
			"RIGHT",
			frames.get("active-tile-secondary-0"),
			-52,
			0,
		);
		expect(
			frames.get("active-tile-checkbox-0")?.setParent,
		).toHaveBeenLastCalledWith(frames.get("active-tile-row-0"));
		expect(
			frames.get("active-tile-checkbox-0")?.setColor,
		).toHaveBeenLastCalledWith(0, 0, 0, 0);
		expect(
			frames.get("active-tile-row-0")?.setOpacity,
		).not.toHaveBeenCalledWith(0.35);
		expect(
			frames.get("active-tile-secondary-0")?.setOpacity,
		).toHaveBeenLastCalledWith(0.35);
		frames.get("active-tile-secondary-0")?.onClick.mock.lastCall?.at(0)(
			"LeftButton",
		);
		expect(activate).not.toHaveBeenCalled();
		expect(list.getNavGrid()).toEqual([]);
		list.updateRows([
			{ ...tile, secondary: { ...tile.secondary, enabled: true } },
		]);
		expect(
			frames.get("active-tile-secondary-0")?.setOpacity,
		).toHaveBeenLastCalledWith(1);
		list.getNavGrid().at(0)?.at(0)?.onInteract();
		expect(activate).toHaveBeenCalledOnce();
	},
);

it("renders checkbox rows and excludes disabled choices while reusing rows for ordinary buttons", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("checkbox", pool, "Test", vi.fn());
	const activate = vi.fn();
	list.setRows([
		{ id: "available", label: "Available", checked: true, activate },
		{ id: "locked", label: "Locked", checked: false, enabled: false, activate },
	]);
	list.mount(new Frame("checkbox-parent", pool));
	expect(
		frames.get("checkbox-row-0")?.setButtonBackground,
	).not.toHaveBeenCalled();
	expect(frames.get("checkbox-row-0")?.setColor).toHaveBeenLastCalledWith(
		0,
		0,
		0,
		0,
	);
	expect(
		frames.get("checkbox-checkbox-0")?.setAtlasBackground,
	).toHaveBeenCalledWith("checkbox-minimal");
	expect(
		frames.get("checkbox-check-0")?.setAtlasBackground,
	).toHaveBeenCalledWith("checkmark-minimal");
	expect(frames.get("checkbox-check-0")?.show).toHaveBeenCalledOnce();
	expect(frames.get("checkbox-check-1")?.hide).toHaveBeenCalledOnce();
	frames.get("checkbox-row-1")?.onClick.mock.lastCall?.at(0)("LeftButton");
	expect(activate).not.toHaveBeenCalled();
	expect(list.getNavGrid().map((row) => row.at(0)?.navId)).toEqual([
		"available",
	]);
	expect(frames.get("checkbox-row-1")?.setOpacity).toHaveBeenLastCalledWith(
		0.35,
	);
	list.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(activate).toHaveBeenCalledOnce();
	list.setRows([{ id: "back", label: "Back", activate }]);
	expect(
		frames.get("checkbox-row-0")?.setButtonBackground,
	).toHaveBeenLastCalledWith(false);
	expect(frames.get("checkbox-checkbox-0")?.hide).toHaveBeenCalled();
	list.setRows([
		{ id: "first", label: "First", activate },
		{ id: "back", label: "Back", activate },
	]);
	expect(frames.get("checkbox-row-1")?.setOpacity).toHaveBeenLastCalledWith(1);
	expect(list.getNavGrid().at(1)?.at(0)?.navId).toBe("back");
});

it("scrolls focused rows into view, accounting for section headings and margins", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("focus-scroll", pool, "Test", vi.fn());
	list.setRows([
		{
			id: "heading",
			label: "Section",
			heading: true,
			marginBottom: 8,
			activate: vi.fn(),
		},
		{ id: "first", label: "First", marginBottom: 20, activate: vi.fn() },
		{ id: "second", label: "Second", activate: vi.fn() },
	]);
	list.mount(new Frame("focus-parent", pool));
	list.getNavGrid().at(1)?.at(0)?.onFocus();
	expect(
		frames.get("focus-scroll-scroll")?.revealVerticalRange,
	).toHaveBeenLastCalledWith(112, 160, 164);
	const manager = new NavigationManager(createTestEventBus());
	manager.registerGrid("list", list.getNavGrid());
	manager.setActiveGrid("list");
	manager.moveUp();
	expect(
		frames.get("focus-scroll-scroll")?.scrollToEdge,
	).toHaveBeenLastCalledWith("up");
	manager.moveDown();
	manager.moveDown();
	expect(
		frames.get("focus-scroll-scroll")?.scrollToEdge,
	).toHaveBeenLastCalledWith("down");
});

it("renders proportional bars, restores header tints on blur and reuses controls", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("test", pool, "Test", vi.fn());
	const row = {
		id: "rep",
		label: "Rep",
		activate: vi.fn(),
		background: [0.1, 0.2, 0.3] as const,
		progress: { value: 0.25, color: [0, 1, 0] as const },
	};
	list.setRows([row]);
	list.mount(new Frame("parent", pool));
	expect(frames.get("test-progress-0")?.layout).toHaveBeenLastCalledWith(
		110,
		6,
		"BOTTOMLEFT",
		expect.anything(),
		0,
		0,
	);
	expect(frames.get("test-progress-0")?.setColor).toHaveBeenLastCalledWith(
		0,
		1,
		0,
	);
	list.getNavGrid().at(0)?.at(0)?.onFocus();
	list.getNavGrid().at(0)?.at(0)?.onBlur();
	expect(frames.get("test-row-0")?.setColor).toHaveBeenLastCalledWith(
		0.1,
		0.2,
		0.3,
	);
	const count = frames.size;
	list.setRows([{ ...row, progress: { ...row.progress, value: 2 } }]);
	expect(frames.get("test-progress-0")?.layout.mock.lastCall?.at(0)).toBe(440);
	list.setRows([{ ...row, progress: { ...row.progress, value: -1 } }]);
	expect(frames.get("test-progress-0")?.hide).toHaveBeenCalled();
	list.setRows([{ id: "header", label: "Header", activate: vi.fn() }]);
	expect(frames.get("test-track-0")?.hide).toHaveBeenCalled();
	expect(frames.size).toBe(count);
	const layouts = frames.get("test-row-0")?.layout;
	layouts?.mockClear();
	list.unmount();
	list.mount(new Frame("parent", pool));
	expect(layouts).not.toHaveBeenCalled();
	list.unmount();
	list.setRows([{ id: "changed", label: "Changed", activate: vi.fn() }]);
	expect(layouts).not.toHaveBeenCalled();
	list.mount(new Frame("parent", pool));
	expect(layouts).toHaveBeenCalledOnce();
	expect(list.getNavGrid().at(0)?.at(0)?.navId).toBe("changed");
	list.destroy();
	expect(frames.get("test-progress-0")?.destroy).toHaveBeenCalledOnce();
});

it("centres content, includes row margins and repositions on resize without rebuilding rows", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("centred", pool, "Test", vi.fn(), {
		verticallyCentered: true,
	});
	list.setRows([
		{ id: "spec", label: "Spec", marginBottom: 24, activate: vi.fn() },
		{ id: "loadout", label: "Loadout", activate: vi.fn() },
	]);
	list.mount(new Frame("centred-parent", pool));
	const content = frames.get("centred-content") as unknown as {
		layoutVerticallyCentered: ReturnType<typeof vi.fn>;
	};
	expect(content.layoutVerticallyCentered).toHaveBeenCalledWith(
		456,
		128,
		expect.anything(),
	);
	expect(frames.get("centred-row-1")?.layout.mock.lastCall?.at(-1)).toBe(-76);
	const scroll = frames.get("centred-scroll") as unknown as {
		onSizeChanged: ReturnType<typeof vi.fn>;
	};
	const resize = scroll.onSizeChanged.mock.lastCall?.at(0) as () => void;
	const count = frames.size;
	frames.get("centred-row-0")?.layout.mockClear();
	resize();
	expect(frames.get("centred-row-0")?.layout).not.toHaveBeenCalled();
	expect(frames.size).toBe(count);
	list.destroy();
	expect(scroll.onSizeChanged).toHaveBeenLastCalledWith();
});

it("renders large lists in bounded frame batches and stops while hidden", () => {
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
	const changed = vi.fn();
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("batch", pool, "Batch", vi.fn(), {
		scheduler,
		onChanged: changed,
	});
	const rows = Array.from({ length: 25 }, (_, index) => ({
		id: `row-${index}`,
		label: `${index}`,
		activate: vi.fn(),
	}));
	list.setRows(rows);
	const parent = new Frame("batch-parent", pool);
	list.mount(parent);
	expect(list.getNavGrid()).toHaveLength(0);
	pending.shift()?.();
	expect(list.getNavGrid()).toHaveLength(10);
	expect(frames.has("batch-row-10")).toBe(false);
	expect(changed).toHaveBeenCalledTimes(2);
	list.unmount();
	pending.shift()?.();
	expect(frames.has("batch-row-10")).toBe(false);
	list.mount(parent);
	while (pending.length) pending.shift()?.();
	expect(list.getNavGrid()).toHaveLength(25);
	list.setRows(rows.slice(0, 1));
	while (pending.length) pending.shift()?.();
	expect(list.getNavGrid()).toHaveLength(1);
	expect(frames.get("batch-row-24")?.hide).toHaveBeenCalled();
	list.setRows(rows);
	list.destroy();
	const notifications = changed.mock.calls.length;
	while (pending.length) pending.shift()?.();
	expect(changed).toHaveBeenCalledTimes(notifications);
});

it("renders compact headings and skips them during navigation and interaction", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("headings", pool, "Test", vi.fn());
	const activate = vi.fn();
	list.setRows([{ id: "old", label: "Old", activate }]);
	list.mount(new Frame("headings-parent", pool));
	const stale = list.getNavGrid().at(0)?.at(0);
	list.setRows([
		{ id: "heading", label: "Section", heading: true, activate },
		{ id: "item", label: "Item", activate },
	]);
	expect(list.getNavGrid().map((row) => row.at(0)?.navId)).toEqual(["item"]);
	expect(frames.get("headings-row-0")?.layout.mock.lastCall?.at(1)).toBe(28);
	expect(frames.get("headings-row-1")?.layout.mock.lastCall?.at(-1)).toBe(-32);
	stale?.onInteract?.();
	expect(activate).not.toHaveBeenCalled();
	list.getNavGrid().at(0)?.at(0)?.onInteract?.();
	expect(activate).toHaveBeenCalledOnce();
});

it("retains ready rows and focus styling when the same prefix grows during rendering", () => {
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
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("growing", pool, "Test", vi.fn(), { scheduler });
	const rows = Array.from({ length: 35 }, (_, index) => ({
		id: `row-${index}`,
		label: `${index}`,
		activate: vi.fn(),
	}));
	list.setRows(rows.slice(0, 20));
	list.mount(new Frame("parent", pool));
	pending.shift()?.();
	const first = list.getNavGrid().at(0)?.at(0);
	first?.onFocus();
	frames.get("growing-row-0")?.layout.mockClear();
	frames.get("growing-row-0")?.setColor.mockClear();
	list.setRows(rows);
	expect(list.getNavGrid()).toHaveLength(10);
	expect(list.getNavGrid().at(0)?.at(0)).toBe(first);
	first?.onInteract();
	expect(rows.at(0)?.activate).toHaveBeenCalledOnce();
	while (pending.length) pending.shift()?.();
	expect(list.getNavGrid()).toHaveLength(35);
	expect(frames.get("growing-row-0")?.layout).not.toHaveBeenCalled();
	expect(frames.get("growing-row-0")?.setColor).not.toHaveBeenCalled();
	expect(frames.get("growing-row-10")?.layout.mock.lastCall?.at(-1)).toBe(-520);
	list.destroy();
});
