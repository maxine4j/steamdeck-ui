import { afterEach, expect, it, vi } from "vitest";
import { CollectionsClient } from "../../clients/collections-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInToys } from "./built-in-toys";

afterEach(() => vi.unstubAllGlobals());

it("suppresses collections only for toys, restores other tabs and ignores hooks after shutdown", () => {
	const hooks = new Map<string, () => void>();
	let shown = false;
	const collections = { IsShown: () => true, HookScript: vi.fn() };
	vi.stubGlobal("CollectionsJournal", collections);
	vi.stubGlobal("ToyBox", {
		IsShown: () => shown,
		HookScript: (script: string, callback: () => void) =>
			hooks.set(script, callback),
	});
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("MountJournal", { IsShown: () => false, HookScript: vi.fn() });
	vi.stubGlobal("PetJournal", { IsShown: () => false, HookScript: vi.fn() });
	vi.stubGlobal("WardrobeCollectionFrame", {
		IsShown: () => false,
		HookScript: vi.fn(),
	});
	vi.stubGlobal("HideUIPanel", vi.fn());
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("TOYS_VISIBILITY_CHANGED", changed);
	const native = new BuiltInToys(new CollectionsClient(frames, events));
	native.disable();
	shown = true;
	hooks.get("OnShow")?.();
	expect(frames.suppress).toHaveBeenCalledWith([collections]);
	shown = false;
	hooks.get("OnHide")?.();
	expect(frames.restore).toHaveBeenCalled();
	native.close();
	expect(HideUIPanel).toHaveBeenCalledExactlyOnceWith(collections);
	native.restore();
	const count = changed.mock.calls.length;
	shown = true;
	hooks.get("OnShow")?.();
	expect(changed).toHaveBeenCalledTimes(count);
	native.disable();
	expect(collections.HookScript).toHaveBeenCalledTimes(2);
});
