import { afterEach, expect, it, vi } from "vitest";
import { EventBus } from "../../events/event-bus";
import { BuiltInBags } from "./built-in-bags";

afterEach(() => vi.unstubAllGlobals());

it("suppresses all Retail bag frames and bridges existing bindings only while enabled", () => {
	const nativeFrames = Array.from({ length: 7 }, () => ({}));
	[
		"ContainerFrameCombinedBags",
		"ContainerFrame1",
		"ContainerFrame2",
		"ContainerFrame3",
		"ContainerFrame4",
		"ContainerFrame5",
		"ContainerFrame6",
	].forEach((name, index) => {
		vi.stubGlobal(name, nativeFrames.at(index));
	});
	const hooks = new Map<string, () => void>();
	const hook = vi.fn((name: string, callback: () => void) =>
		hooks.set(name, callback),
	);
	vi.stubGlobal("hooksecurefunc", hook);
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const events = new EventBus();
	const visibility = vi.fn();
	events.subscribe("BAG_VISIBILITY_CHANGED", visibility);
	const bags = new BuiltInBags(frames, events);
	bags.disable();
	bags.disable();
	expect(frames.suppress).toHaveBeenCalledExactlyOnceWith(nativeFrames);
	hooks.get("ToggleAllBags")?.();
	hooks.get("ToggleBackpack")?.();
	hooks.get("CloseSpecialWindows")?.();
	expect(visibility).toHaveBeenCalledTimes(3);
	bags.restore();
	hooks.get("ToggleAllBags")?.();
	expect(visibility).toHaveBeenCalledTimes(3);
	expect(frames.restore).toHaveBeenCalledOnce();
	const hookCount = hook.mock.calls.length;
	bags.disable();
	expect(hook).toHaveBeenCalledTimes(hookCount);
	hooks.get("OpenAllBags")?.();
	expect(visibility).toHaveBeenCalledTimes(4);
});
