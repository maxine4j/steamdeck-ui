import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { NavigationManager } from "./navigation-manager";
import type { INavigable, NavGrid } from "./types";

const node = (navId: string): INavigable => ({
	navId,
	onFocus: vi.fn(),
	onBlur: vi.fn(),
	onInteract: vi.fn(),
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
