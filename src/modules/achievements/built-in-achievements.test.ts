import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInAchievements } from "./built-in-achievements";

afterEach(() => vi.unstubAllGlobals());
it("suppresses the native personal view, forwards selection and restores on shutdown", () => {
	const scripts = new Map<string, () => void>();
	const hooks = new Map<string, (...args: unknown[]) => void>();
	const frame = {
		IsShown: () => true,
		selectedTab: 1,
		HookScript: (name: string, cb: () => void) => scripts.set(name, cb),
	};
	vi.stubGlobal("AchievementFrame", frame);
	vi.stubGlobal("AchievementFrame_LoadUI", () => true);
	vi.stubGlobal(
		"hooksecurefunc",
		(name: string, cb: (...args: unknown[]) => void) => hooks.set(name, cb),
	);
	const events = createTestEventBus();
	const select = vi.fn();
	events.subscribe("ACHIEVEMENTS_SELECTED", select);
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const native = new BuiltInAchievements(frames, events);
	native.disable();
	expect(frames.suppress).toHaveBeenCalledWith([frame]);
	hooks.get("AchievementFrame_SelectAchievement")?.(123);
	expect(select).toHaveBeenCalledWith({ id: 123 });
	frame.selectedTab = 3;
	scripts.get("OnShow")?.();
	expect(frames.restore).toHaveBeenCalled();
	native.restore();
	hooks.get("AchievementFrame_SelectAchievement")?.(456);
	expect(select).toHaveBeenCalledOnce();
});
