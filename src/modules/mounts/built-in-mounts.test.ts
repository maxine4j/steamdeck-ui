import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInMounts } from "./built-in-mounts";

afterEach(() => vi.unstubAllGlobals());
it("suppresses collections only for mounts and restores it on tab changes and shutdown", () => {
	const hooks = new Map<string, () => void>();
	let shown = false;
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("MountJournal", {
		IsShown: () => shown,
		HookScript: (event: string, callback: () => void) =>
			hooks.set(event, callback),
	});
	const collections = { IsShown: () => true, HookScript: vi.fn() };
	vi.stubGlobal("CollectionsJournal", collections);
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("MOUNTS_VISIBILITY_CHANGED", changed);
	const native = new BuiltInMounts(frames, events);
	native.disable();
	shown = true;
	hooks.get("OnShow")?.();
	expect(frames.suppress).toHaveBeenCalledWith([collections]);
	shown = false;
	hooks.get("OnHide")?.();
	expect(frames.restore).toHaveBeenCalled();
	native.restore();
	const count = changed.mock.calls.length;
	shown = true;
	hooks.get("OnShow")?.();
	expect(changed).toHaveBeenCalledTimes(count);
	native.disable();
	expect(collections.HookScript).toHaveBeenCalledTimes(2);
});
