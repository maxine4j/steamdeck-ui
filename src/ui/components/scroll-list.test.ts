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
	list.destroy();
	expect(frames.get("test-progress-0")?.destroy).toHaveBeenCalledOnce();
});
