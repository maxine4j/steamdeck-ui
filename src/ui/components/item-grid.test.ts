import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ItemGrid } from "./item-grid";

const { layouts, insets } = vi.hoisted(() => ({
	layouts: new Map<string, ReturnType<typeof vi.fn>>(),
	insets: vi.fn(),
}));
const { reveals } = vi.hoisted(() => ({ reveals: vi.fn() }));
const { edges } = vi.hoisted(() => ({ edges: vi.fn() }));
const { mouseFocus } = vi.hoisted(() => ({
	mouseFocus: new Map<string, (() => void) | undefined>(),
}));
vi.mock("./frame", () => ({
	Frame: class {
		constructor(readonly id: string) {
			layouts.set(id, this.layout);
		}
		layout = vi.fn();
		setNavigationFocus = (callback?: () => void) =>
			mouseFocus.set(this.id, callback);
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
		setSpell = vi.fn();
		clearTooltip = vi.fn();
		onClick = vi.fn();
		destroy = vi.fn();
		inset = insets;
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		scrollToEdge = edges;
		revealVerticalRange = reveals;
	},
}));

it("lays out two columns under group headers, routes actions and reuses cells", () => {
	const pool = {} as IFramePoolManager;
	const grid = new ItemGrid("items", pool);
	grid.mount(new Frame("parent", pool));
	expect(insets).toHaveBeenCalledWith(expect.anything(), 16, 112, 8, 16);
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
	for (const node of grid.getNavGrid().flat()) {
		node.navigationScroll?.scrollToEdge("up");
		expect(edges).toHaveBeenLastCalledWith("up");
		node.navigationScroll?.scrollToEdge("down");
		expect(edges).toHaveBeenLastCalledWith("down");
	}
	const count = layouts.size;
	grid.unmount();
	expect(grid.getNavGrid()).toEqual([]);
	grid.mount(new Frame("parent", pool));
	expect(layouts.size).toBe(count);
});

it("offers secure spell icons, contextual binding and spell tooltips without insecure casting", () => {
	const pool = {} as IFramePoolManager;
	const grid = new ItemGrid("spells", pool, "No spells", { secureIcons: true });
	const bind = vi.fn();
	const activate = vi.fn();
	grid.setGroups([
		{
			id: "class",
			items: [
				{
					id: "spell-42",
					name: "Heal",
					icon: 1,
					spell: 42,
					hyperlink: "spell:42",
					activate,
					context: bind,
				},
			],
		},
	]);
	grid.mount(new Frame("parent", pool));
	const node = grid.getNavGrid().at(0)?.at(0);
	expect(node?.secureActions?.().alternate?.id).toBe("spells-icon-0");
	const focus = vi.fn();
	node?.mouseTarget?.setNavigationFocus(focus);
	expect(mouseFocus.get("spells-icon-0")).toBeTypeOf("function");
	mouseFocus.get("spells-icon-0")?.();
	mouseFocus.get("spells-cell-0")?.();
	expect(focus).toHaveBeenCalledTimes(2);
	node?.mouseTarget?.setNavigationFocus(undefined);
	expect(mouseFocus.get("spells-icon-0")).toBeUndefined();
	node?.onAlternate?.();
	expect(activate).not.toHaveBeenCalled();
	node?.onContext?.();
	expect(bind).toHaveBeenCalledOnce();
	expect(node?.tooltipItem?.()).toBe("spell:42");
	grid.unmount();
	expect(node?.secureActions?.().alternate).toBeUndefined();
	node?.onContext?.();
	expect(bind).toHaveBeenCalledOnce();
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
