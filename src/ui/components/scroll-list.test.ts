import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ScrollList } from "./scroll-list";

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
			setLabelWordWrap: ReturnType<typeof vi.fn>;
		}
	>(),
}));

it("omits its own close button when the containing panel provides one", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("embedded", pool, "", vi.fn(), {
		showClose: false,
	});
	list.mount(new Frame("embedded-parent", pool));
	expect(frames.get("embedded-close")?.show).not.toHaveBeenCalled();
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
		setAnimatedAtlas = vi.fn();
		layoutVerticallyCentered = vi.fn();
		onSizeChanged = vi.fn();
		setColor = vi.fn();
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
		setTooltip = vi.fn();
		onClick = vi.fn();
		inset = vi.fn();
		fill = vi.fn();
		setBlackBackground = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
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

it("renders checkbox rows and excludes disabled choices while reusing rows for ordinary buttons", () => {
	const pool = {} as IFramePoolManager;
	const list = new ScrollList("checkbox", pool, "Test", vi.fn());
	const activate = vi.fn();
	list.setRows([
		{ id: "available", label: "Available", checked: true, activate },
		{ id: "locked", label: "Locked", checked: false, enabled: false, activate },
	]);
	list.mount(new Frame("checkbox-parent", pool));
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
