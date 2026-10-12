import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ItemGrid } from "./item-grid";

const { layouts } = vi.hoisted(() => ({
	layouts: new Map<string, ReturnType<typeof vi.fn>>(),
}));
const { reveals } = vi.hoisted(() => ({ reveals: vi.fn() }));
vi.mock("./frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			layouts.set(id, this.layout);
		}
		layout = vi.fn();
		setParent = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		setColor = vi.fn();
		setFocused = vi.fn();
		setCloseButtonBackground = vi.fn();
		setInsetBackground = vi.fn();
		setButtonBackground = vi.fn();
		setWindowBackground = vi.fn();
		setLabel = vi.fn();
		setIcon = vi.fn();
		setTooltip = vi.fn();
		onClick = vi.fn();
		destroy = vi.fn();
		inset = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		revealVerticalRange = reveals;
	},
}));

it("lays out two columns under group headers, routes actions and reuses cells", () => {
	const pool = {} as IFramePoolManager;
	const grid = new ItemGrid("items", pool);
	const activate = vi.fn();
	const favourite = vi.fn();
	grid.setGroups([
		{
			id: "cloth",
			label: "Cloth",
			items: [1, 2, 3].map((id) => ({
				id: `${id}`,
				name: `Item ${id}`,
				icon: id,
				detail: "Upgrade 2",
				activate,
				secondary: { label: "*", activate: favourite },
			})),
		},
	]);
	grid.mount(new Frame("parent", pool));
	expect(layouts.get("items-cell-0")?.mock.calls.at(-1)?.slice(-2)).toEqual([
		0, -28,
	]);
	expect(layouts.get("items-cell-1")?.mock.calls.at(-1)?.slice(-2)).toEqual([
		234, -28,
	]);
	expect(layouts.get("items-cell-2")?.mock.calls.at(-1)?.slice(-2)).toEqual([
		0, -94,
	]);
	expect(grid.getNavGrid().map((row) => row.map((node) => node.navId))).toEqual(
		[
			["1", "1-secondary", "2", "2-secondary"],
			["3", "3-secondary"],
		],
	);
	grid.getNavGrid().at(0)?.at(0)?.onInteract();
	expect(activate).toHaveBeenCalledOnce();
	grid.getNavGrid().at(0)?.at(1)?.onInteract();
	expect(favourite).toHaveBeenCalledOnce();
	const count = layouts.size;
	grid.unmount();
	expect(grid.getNavGrid()).toEqual([]);
	grid.mount(new Frame("parent", pool));
	expect(layouts.size).toBe(count);
});

it("reveals focused tiles across vertically stacked groups and resolves their tooltips", () => {
	reveals.mockClear();
	const pool = {} as IFramePoolManager;
	const grid = new ItemGrid("pages", pool);
	grid.setGroups(
		[1, 2].map((page) => ({
			id: `${page}`,
			label: `Page ${page}`,
			items: Array.from({ length: 10 }, (_, index) => ({
				id: `${page}-${index}`,
				name: "Item",
				icon: 1,
				hyperlink: `item:${page}-${index}`,
				activate: vi.fn(),
			})),
		})),
	);
	grid.mount(new Frame("parent", pool));
	const node = grid.getNavGrid().at(5)?.at(0);
	node?.onFocus();
	expect(reveals).toHaveBeenCalledWith(398, 458, 740);
	expect(node?.tooltipItem?.()).toBe("item:2-0");
});
