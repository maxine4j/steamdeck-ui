import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { Frame } from "../components/frame";
import type { IFramePoolManager } from "../frame-pool-manager";
import { NavigationManager } from "./navigation-manager";
import type { INavigable, NavGrid } from "./types";

const node = (navId: string): INavigable => ({
	navId,
	onFocus: vi.fn(),
	onBlur: vi.fn(),
	onInteract: vi.fn(),
});

it("adjusts a slider horizontally while keeping vertical navigation available", () => {
	const manager = new NavigationManager(createTestEventBus());
	const adjust = vi.fn();
	manager.registerGrid("settings", [
		[{ ...node("slider"), onAdjust: adjust }, node("other")],
		[node("below")],
	]);
	manager.setActiveGrid("settings");
	manager.moveRight();
	manager.moveLeft();
	expect(adjust.mock.calls).toEqual([[1], [-1]]);
	expect(manager.focusedId).toBe("slider");
	manager.moveDown();
	expect(manager.focusedId).toBe("below");
});

it("activates one immediate action, falling back to regular selection", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const immediate = { ...node("mount"), onAlternate: vi.fn() };
	const selection = node("filter");
	manager.registerGrid("panel", [[immediate, selection]]);
	manager.setActiveGrid("panel");
	events.emit("NAV_INTERACT");
	expect(immediate.onAlternate).toHaveBeenCalledOnce();
	expect(immediate.onInteract).not.toHaveBeenCalled();
	manager.moveRight();
	events.emit("NAV_INTERACT");
	expect(selection.onInteract).toHaveBeenCalledOnce();
});

it("traps an open control's scope until cancel dismisses it", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const cancel = vi.fn();
	const cycle = vi.fn();
	const closePanel = vi.fn();
	const scope = { cancel };
	let grid: NavGrid = [
		[node("search")],
		[{ ...node("checkbox"), navigationScope: scope }],
		[{ ...node("radio"), navigationScope: scope }],
		[node("footer")],
	];
	manager.registerGrid("panel", () => grid, {
		right: "other",
		onPanelCycle: cycle,
		onCancel: closePanel,
	});
	manager.registerGrid("other", [[node("other")]]);
	manager.setActiveGrid("panel");
	expect(manager.focusedId).toBe("checkbox");
	manager.moveUp();
	expect(manager.focusedId).toBe("checkbox");
	manager.moveDown();
	manager.moveDown();
	expect(manager.focusedId).toBe("radio");
	events.emit("NAV_CONTAINER_RIGHT");
	events.emit("NAV_PANEL_NEXT");
	manager.setActiveGrid("other");
	expect(manager.focusedId).toBe("radio");
	expect(cycle).not.toHaveBeenCalled();
	events.emit("NAV_CANCEL");
	expect(cancel).toHaveBeenCalledOnce();
	expect(closePanel).not.toHaveBeenCalled();
	grid = [[node("search")]];
	manager.refreshGrid("panel");
	events.emit("NAV_CONTAINER_RIGHT");
	expect(manager.focusedId).toBe("other");
	manager.setActiveGrid("panel");
	grid = [[{ ...node("checkbox"), navigationScope: scope }]];
	manager.refreshGrid("panel");
	manager.destroy();
	manager.registerGrid("reused", [[node("reused")]]);
	manager.setActiveGrid("reused");
	expect(manager.focusedId).toBe("reused");
});

it("follows mouse focus across grids, continues movement there and traps modals", () => {
	const manager = new NavigationManager(createTestEventBus());
	let click: (() => void) | undefined;
	const clicked = {
		...node("clicked"),
		mouseTarget: {
			setNavigationFocus: (callback?: () => void) => {
				click = callback;
			},
		},
	};
	manager.registerGrid("left", [[node("left")]]);
	manager.registerGrid("right", [[node("first"), clicked, node("next")]]);
	manager.setActiveGrid("left");
	expect(click).toBeTypeOf("function");
	click?.();
	expect(manager.focusedId).toBe("clicked");
	expect(clicked.onInteract).not.toHaveBeenCalled();
	manager.moveRight();
	expect(manager.focusedId).toBe("next");
	manager.pushModal("dialog", [[node("confirm")]], vi.fn());
	click?.();
	expect(manager.focusedId).toBe("confirm");
	manager.popModal("dialog");
	expect(manager.focusedId).toBe("next");
	manager.unregisterGrid("right");
	expect(click).toBeUndefined();
});

it("unbinds removed mouse controls and rebinds recycled targets to their current node", () => {
	const manager = new NavigationManager(createTestEventBus());
	let click: (() => void) | undefined;
	const mouseTarget = {
		setNavigationFocus: (callback?: () => void) => {
			click = callback;
		},
	};
	let grid: NavGrid = [[{ ...node("old"), mouseTarget }]];
	manager.registerGrid("panel", () => grid);
	manager.setActiveGrid("panel");
	grid = [[node("first"), { ...node("new"), mouseTarget }]];
	manager.refreshGrid("panel");
	click?.();
	expect(manager.focusedId).toBe("new");
	grid = [[node("first")]];
	manager.refreshGrid("panel");
	expect(click).toBeUndefined();
	manager.destroy();
});

it("restores nested modal focus and safely removes a covered dialog", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	manager.registerGrid("bags", [[node("item")]]);
	manager.setActiveGrid("bags");
	const cancel = vi.fn();
	manager.pushModal("options", [[node("option")]], cancel);
	manager.pushModal("game-menu", [[node("settings"), node("logout")]], vi.fn());
	manager.moveRight();
	manager.pushModal("invite", [[node("accept")]], vi.fn());
	manager.popModal("invite");
	expect(manager.focusedId).toBe("logout");
	manager.pushModal("release", [[node("spirit")]], vi.fn());
	manager.popModal("game-menu");
	expect(manager.focusedId).toBe("spirit");
	manager.popModal("release");
	expect(manager.focusedId).toBe("option");
	events.emit("NAV_CANCEL");
	expect(cancel).toHaveBeenCalledOnce();
	manager.popModal("options");
	expect(manager.focusedId).toBe("item");
});

it("does not pull a held D-pad boundary scroll back to the focused row on batch refresh", () => {
	const focused = vi
		.spyOn(Frame.prototype, "setFocused")
		.mockImplementation(() => {});
	try {
		let scroll = 0;
		const viewport = {
			scrollToEdge: () => {
				scroll = 1000;
			},
		};
		const frame = new Frame("last", {} as IFramePoolManager);
		const makeLast = () => ({
			...frame.navigationNode("last", vi.fn(), () => {
				scroll = 100;
			}),
			navigationScroll: viewport,
		});
		let last = makeLast();
		const manager = new NavigationManager(createTestEventBus());
		manager.registerGrid("collection", () => [[node("first")], [last]]);
		manager.setActiveGrid("collection");
		manager.moveDown();
		expect(scroll).toBe(100);
		for (let batch = 0; batch < 3; batch++) {
			manager.moveDown();
			expect(scroll).toBe(1000);
			last = makeLast();
			manager.refreshGrid("collection");
			expect(manager.focusedId).toBe("last");
			expect(scroll).toBe(1000);
			expect(focused).toHaveBeenLastCalledWith(true, false, true);
		}
		manager.moveUp();
		manager.moveDown();
		expect(scroll).toBe(100);
		manager.destroy();
	} finally {
		focused.mockRestore();
	}
});

it("routes D-pad input to a continuous control without changing focus", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const move = vi.fn();
	manager.registerGrid("canvas", [[{ ...node("cursor"), onMove: move }]]);
	manager.setActiveGrid("canvas");
	for (const event of ["NAV_UP", "NAV_DOWN", "NAV_LEFT", "NAV_RIGHT"] as const)
		events.emit(event);
	expect(move).not.toHaveBeenCalled();
	events.emit("NAV_DIRECTION_CHANGED", { direction: "right", pressed: true });
	events.emit("NAV_DIRECTION_CHANGED", { direction: "right", pressed: false });
	expect(move.mock.calls).toEqual([
		["right", true],
		["right", false],
	]);
	expect(manager.focusedId).toBe("cursor");
});

it("selects a requested grid node and publishes its tooltip on refresh", () => {
	const changed = vi.fn();
	const manager = new NavigationManager(
		createTestEventBus(),
		undefined,
		changed,
	);
	const second = { ...node("second"), tooltipItem: () => "Achievement" };
	manager.registerGrid("panel", [[node("first"), second]]);
	manager.setActiveGrid("panel");
	manager.refreshGrid("panel", "second");
	expect(manager.focusedId).toBe("second");
	expect(changed).toHaveBeenLastCalledWith(second);
	manager.moveLeft();
	expect(manager.focusedId).toBe("first");
});

it("finishes scrolling on repeated vertical boundary presses without changing focus", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const boundary = vi.fn();
	const navigationScroll = { scrollToEdge: boundary };
	const first = { ...node("first"), navigationScroll };
	const last = { ...node("last"), navigationScroll };
	manager.registerGrid("scroll", [[first], [last]]);
	manager.setActiveGrid("scroll");
	events.emit("NAV_UP");
	events.emit("NAV_UP");
	expect(boundary.mock.calls).toEqual([["up"], ["up"]]);
	expect(first.onFocus).toHaveBeenCalledOnce();
	events.emit("NAV_DOWN");
	expect(boundary).toHaveBeenCalledTimes(2);
	events.emit("NAV_DOWN");
	events.emit("NAV_DOWN");
	expect(boundary.mock.calls.slice(2)).toEqual([["down"], ["down"]]);
	expect(manager.focusedId).toBe("last");
	events.emit("NAV_LEFT");
	events.emit("NAV_RIGHT");
	expect(boundary).toHaveBeenCalledTimes(4);
});

it("finishes scrolling when vertical focus leaves a viewport for a panel control", () => {
	const manager = new NavigationManager(createTestEventBus());
	const scrollToEdge = vi.fn();
	manager.registerGrid("panel", [
		[node("tab")],
		[{ ...node("item"), navigationScroll: { scrollToEdge } }],
		[node("footer")],
	]);
	manager.setActiveGrid("panel");
	manager.moveDown();
	expect(scrollToEdge).not.toHaveBeenCalled();
	manager.moveUp();
	expect(scrollToEdge).toHaveBeenLastCalledWith("up");
	expect(manager.focusedId).toBe("tab");
	manager.moveDown();
	manager.moveDown();
	expect(scrollToEdge).toHaveBeenLastCalledWith("down");
	expect(manager.focusedId).toBe("footer");
});

it("routes B to the active panel and gives modal cancellation priority", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const back = vi.fn();
	manager.registerGrid("finder", [[node("dungeon")]], { onCancel: back });
	manager.setActiveGrid("finder");
	events.emit("NAV_CANCEL");
	expect(back).toHaveBeenCalledOnce();
	const cancel = vi.fn();
	manager.pushModal("modal", [[node("confirm")]], cancel);
	events.emit("NAV_CANCEL");
	expect(cancel).toHaveBeenCalledOnce();
	expect(back).toHaveBeenCalledOnce();
});

it("publishes focused item changes, refreshes stable nodes and clears during modals and shutdown", () => {
	const changed = vi.fn();
	const manager = new NavigationManager(
		createTestEventBus(),
		undefined,
		changed,
	);
	let link = "item:42:bonus";
	const item = { ...node("item"), tooltipItem: () => link };
	manager.registerGrid("bags", [[item, node("toggle")]]);
	manager.setActiveGrid("bags");
	expect(changed).toHaveBeenLastCalledWith(item);
	changed.mockClear();
	link = "item:43";
	manager.refreshGrid("bags");
	expect(changed).toHaveBeenCalledOnce();
	expect(item.onFocus).toHaveBeenCalledTimes(2);
	expect(changed.mock.lastCall?.at(0).tooltipItem()).toBe("item:43");
	manager.pushModal("menu", [[node("cancel")]], vi.fn());
	expect(changed.mock.lastCall?.at(0).tooltipItem).toBeUndefined();
	manager.popModal("menu");
	expect(changed).toHaveBeenLastCalledWith(item);
	manager.moveRight();
	expect(changed.mock.lastCall?.at(0).tooltipItem).toBeUndefined();
	manager.destroy();
	expect(changed).toHaveBeenLastCalledWith(undefined);
});

it("routes context input and traps modal focus until cancellation restores the item", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const item = { ...node("item"), onContext: vi.fn(), onAlternate: vi.fn() };
	const cancel = vi.fn(() => manager.popModal("menu"));
	manager.registerGrid("bags", [[item]]);
	manager.setActiveGrid("bags");
	events.emit("NAV_ALTERNATE");
	expect(item.onAlternate).toHaveBeenCalledOnce();
	events.emit("NAV_CONTEXT");
	expect(item.onContext).toHaveBeenCalledOnce();
	manager.pushModal("menu", [[node("cancel")]], cancel);
	manager.registerGrid("other", [[node("other")]]);
	manager.setActiveGrid("other");
	manager.moveLeft();
	expect(manager.focusedId).toBe("cancel");
	events.emit("NAV_CANCEL");
	expect(cancel).toHaveBeenCalledOnce();
	expect(manager.focusedId).toBe("item");
});

it("routes D-pad input through sparse rows, holds at edges and interacts with focus", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const toggle = node("toggle"),
		first = node("first"),
		last = node("last"),
		lower = node("lower");
	last.navColumn = 2;
	lower.navColumn = 2;
	manager.registerGrid("bags", [[toggle], [first, last], [lower]]);
	manager.setActiveGrid("bags");
	expect(toggle.onFocus).toHaveBeenCalledOnce();
	events.emit("NAV_DOWN");
	expect(first.onFocus).toHaveBeenCalledOnce();
	events.emit("NAV_RIGHT");
	expect(last.onFocus).toHaveBeenCalledOnce();
	events.emit("NAV_RIGHT");
	expect(last.onFocus).toHaveBeenCalledOnce();
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(lower.onInteract).toHaveBeenCalledOnce();
	events.emit("NAV_UP");
	expect(last.onFocus).toHaveBeenCalledTimes(2);
	expect(first.onBlur).toHaveBeenCalledOnce();
});

it("preserves stable focus during refresh, removes stale focus and restores another open grid", () => {
	const events = createTestEventBus();
	const active = vi.fn();
	const manager = new NavigationManager(events, active);
	const a = node("a"),
		b = node("b"),
		tab = node("tab");
	let grid: NavGrid = [[a, b]];
	manager.registerGrid("bags", () => grid);
	manager.setActiveGrid("bags");
	manager.moveRight();
	grid = [[b, a]];
	manager.refreshGrid("bags");
	expect(manager.focusedId).toBe("b");
	grid = [[a]];
	manager.refreshGrid("bags");
	expect(b.onBlur).toHaveBeenCalledOnce();
	expect(manager.focusedId).toBe("a");
	manager.registerGrid("left", [[tab]]);
	manager.setActiveGrid("left");
	manager.unregisterGrid("left");
	expect(manager.focusedId).toBe("a");
	manager.unregisterGrid("bags");
	expect(active).toHaveBeenLastCalledWith(false);
	events.emit("NAV_INTERACT");
	expect(a.onInteract).not.toHaveBeenCalled();
	manager.destroy();
	expect(a.onBlur).toHaveBeenCalledTimes(3);
});

it("replaces callbacks when a control with the same identity is rebuilt", () => {
	const manager = new NavigationManager(createTestEventBus());
	const old = node("item"),
		replacement = node("item");
	manager.registerGrid("bags", [[old]]);
	manager.setActiveGrid("bags");
	manager.registerGrid("bags", [[replacement]]);
	manager.interact();
	expect(old.onBlur).toHaveBeenCalledOnce();
	expect(replacement.onFocus).toHaveBeenCalledOnce();
	expect(replacement.onInteract).toHaveBeenCalledOnce();
});

it("uses triggers to switch open containers, remembers focus and keeps D-pad inside content", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const left = node("left-tab"),
		right = node("bag-tab"),
		last = node("last-item");
	manager.registerGrid("left", [[left]], { right: "right" });
	manager.registerGrid("right", [[right, last]], { left: "left" });
	manager.setActiveGrid("right");
	manager.moveLeft();
	expect(manager.focusedId).toBe("bag-tab");
	manager.moveRight();
	events.emit("NAV_CONTAINER_LEFT");
	expect(manager.focusedId).toBe("left-tab");
	manager.moveRight();
	expect(manager.focusedId).toBe("left-tab");
	events.emit("NAV_CONTAINER_RIGHT");
	expect(manager.focusedId).toBe("last-item");
	manager.unregisterGrid("left");
	events.emit("NAV_CONTAINER_LEFT");
	expect(manager.focusedId).toBe("last-item");
});

it("routes bumpers only to the active container and traps switching during modals", () => {
	const events = createTestEventBus();
	const manager = new NavigationManager(events);
	const cycle = vi.fn();
	manager.registerGrid("left", [[node("item")]], {
		right: "right",
		onPanelCycle: cycle,
	});
	manager.registerGrid("right", [[node("other")]]);
	manager.setActiveGrid("left");
	events.emit("NAV_PANEL_NEXT");
	events.emit("NAV_PANEL_PREVIOUS");
	expect(cycle.mock.calls).toEqual([[1], [-1]]);
	manager.pushModal("menu", [[node("cancel")]], () => manager.popModal("menu"));
	events.emit("NAV_PANEL_NEXT");
	events.emit("NAV_CONTAINER_RIGHT");
	expect(cycle).toHaveBeenCalledTimes(2);
	expect(manager.focusedId).toBe("cancel");
	manager.popModal("menu");
	events.emit("NAV_CONTAINER_RIGHT");
	expect(manager.focusedId).toBe("other");
	manager.destroy();
	events.emit("NAV_PANEL_NEXT");
	expect(cycle).toHaveBeenCalledTimes(2);
});

it("reports active containers even with empty content and clears focus styling on close", () => {
	const active = vi.fn();
	const left = vi.fn();
	const right = vi.fn();
	const manager = new NavigationManager(createTestEventBus(), active);
	manager.registerGrid("left", [], { onActiveChanged: left });
	manager.registerGrid("right", [], { onActiveChanged: right });
	manager.setActiveGrid("left");
	expect(active).toHaveBeenLastCalledWith(true);
	expect(left).toHaveBeenLastCalledWith(true);
	manager.setActiveGrid("right");
	expect(left).toHaveBeenLastCalledWith(false);
	expect(right).toHaveBeenLastCalledWith(true);
	manager.unregisterGrid("right");
	expect(right).toHaveBeenLastCalledWith(false);
	expect(left).toHaveBeenLastCalledWith(true);
	manager.destroy();
	expect(left).toHaveBeenLastCalledWith(false);
	expect(active).toHaveBeenLastCalledWith(false);
});
