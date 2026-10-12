import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { AchievementsModule } from "./achievements-module";

it("routes bindings, specific achievements and updates through injected dependencies", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn(), closePanel: vi.fn() };
	const view = { refresh: vi.fn(), selectAchievement: vi.fn() };
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
	expect(ui.openPanel).toHaveBeenCalledWith("achievements", "fullscreen");
	events.emit("ACHIEVEMENTS_SELECTED", { id: 123 });
	expect(view.selectAchievement).toHaveBeenCalledWith(123);
	events.emit("ACHIEVEMENTS_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("ACHIEVEMENTS_CHANGED");
	expect(view.refresh).toHaveBeenCalledOnce();
	expect(native.restore).toHaveBeenCalledOnce();
});
