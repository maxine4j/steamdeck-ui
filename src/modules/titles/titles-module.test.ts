import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { TitlesModule } from "./titles-module";

it("owns titles updates and native sidebar input independently of Paper Doll", () => {
	const events = createTestEventBus();
	const ui = { openPanel: vi.fn() };
	const view = { refresh: vi.fn() };
	const native = { disable: vi.fn(), restore: vi.fn() };
	const module = new TitlesModule(ui, events, view, native);
	module.disableBuiltIn();
	module.initialize();
	events.emit("TITLES_OPEN");
	expect(ui.openPanel).toHaveBeenCalledExactlyOnceWith("titles", "left");
	events.emit("TITLES_CHANGED");
	expect(view.refresh).toHaveBeenCalled();
	module.shutdown();
	const count = view.refresh.mock.calls.length;
	events.emit("TITLES_CHANGED");
	expect(view.refresh).toHaveBeenCalledTimes(count);
	expect(native.restore).toHaveBeenCalledOnce();
});
