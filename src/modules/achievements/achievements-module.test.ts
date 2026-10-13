import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { AchievementsModule } from "./achievements-module";

it("routes bindings, specific achievements and updates through injected dependencies", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { invalidate: vi.fn(), selectAchievement: vi.fn() };
	const native = {
		disable: vi.fn(),
		restore: vi.fn(),
		close: vi.fn(),
		isOpen: () => true,
	};
	const module = new AchievementsModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	events.emit("ACHIEVEMENTS_VISIBILITY_CHANGED");
	expect(ui.openPanel).toHaveBeenCalledWith("achievements", "left");
	events.emit("ACHIEVEMENTS_SELECTED", { id: 123 });
	expect(view.selectAchievement).toHaveBeenCalledWith(123);
	events.emit("ACHIEVEMENTS_CHANGED");
	expect(view.invalidate).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("ACHIEVEMENTS_CHANGED");
	expect(view.invalidate).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});

it("closes the left achievement pane when the native UI is hidden", () => {
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const module = new AchievementsModule(
		ui,
		createTestEventBus(),
		{ invalidate: vi.fn(), selectAchievement: vi.fn() },
		{ disable: vi.fn(), restore: vi.fn(), close: vi.fn(), isOpen: () => false },
	);
	module.initialize();
	expect(ui.closePanel).toHaveBeenCalledWith("left", "achievements");
});

it("starts and stops login backfill and routes targeted changes and cache updates", () => {
	const events = createTestEventBus();
	const journal = { prefetch: vi.fn(), stop: vi.fn(), invalidate: vi.fn() };
	const view = { invalidate: vi.fn(), selectAchievement: vi.fn() };
	const module = new AchievementsModule(
		{ openPanel: vi.fn(), closePanel: vi.fn() },
		events,
		view,
		{ disable: vi.fn(), restore: vi.fn(), isOpen: () => false },
		journal,
	);
	module.initialize();
	expect(journal.prefetch).toHaveBeenCalledOnce();
	events.emit("ACHIEVEMENTS_CHANGED", { id: 42 });
	expect(journal.invalidate).toHaveBeenCalledWith(42);
	events.emit("ACHIEVEMENTS_CACHE_UPDATED");
	expect(view.invalidate).toHaveBeenCalledTimes(2);
	module.shutdown();
	expect(journal.stop).toHaveBeenCalledOnce();
});
