import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ScrollList } from "./scroll-list";

const { frames } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			setColor: ReturnType<typeof vi.fn>;
			hide: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
		}
	>(),
}));
vi.mock("./frame", () => ({
	Frame: class {
		constructor(id: string) {
			frames.set(id, this);
		}
		layout = vi.fn();
		setColor = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		setParent = vi.fn();
		show = vi.fn();
		setLabel = vi.fn();
		setIcon = vi.fn();
		setTooltip = vi.fn();
		onClick = vi.fn();
		inset = vi.fn();
		fill = vi.fn();
		setBlackBackground = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
	},
}));

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
