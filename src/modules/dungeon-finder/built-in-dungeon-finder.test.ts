import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInDungeonFinder } from "./built-in-dungeon-finder";

afterEach(() => vi.unstubAllGlobals());

it("suppresses only the dungeon finder, preserves other finder tabs and restores on shutdown", () => {
	let shown = false;
	let dungeonShown = true;
	const hooks: (() => void)[] = [];
	const pve = {
		IsShown: () => shown,
		HookScript: (_script: string, callback: () => void) => hooks.push(callback),
	};
	vi.stubGlobal("PVEFrame", pve);
	vi.stubGlobal("LFDParentFrame", {
		IsShown: () => dungeonShown,
		HookScript: vi.fn(),
	});
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const visibility = vi.fn();
	events.subscribe("DUNGEON_FINDER_VISIBILITY_CHANGED", visibility);
	const native = new BuiltInDungeonFinder(frames, events);
	native.disable();
	shown = true;
	hooks.at(0)?.();
	expect(frames.suppress).toHaveBeenCalledWith([pve]);
	dungeonShown = false;
	hooks.at(0)?.();
	expect(native.isOpen()).toBe(false);
	expect(frames.suppress).toHaveBeenCalledOnce();
	expect(frames.restore).toHaveBeenCalled();
	native.restore();
	visibility.mockClear();
	hooks.at(0)?.();
	expect(visibility).not.toHaveBeenCalled();
});
