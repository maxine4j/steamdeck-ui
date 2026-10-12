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

it("crosses explicit container edges only while their grids are open", () => {
	const manager = new NavigationManager(createTestEventBus());
	const left = node("left-tab"),
		right = node("bag-tab");
	manager.registerGrid("left", [[left]], { right: "right" });
	manager.registerGrid("right", [[right]], { left: "left" });
	manager.setActiveGrid("right");
	manager.moveLeft();
	expect(manager.focusedId).toBe("left-tab");
	manager.moveRight();
	expect(manager.focusedId).toBe("bag-tab");
	manager.unregisterGrid("left");
	manager.moveLeft();
	expect(manager.focusedId).toBe("bag-tab");
});
