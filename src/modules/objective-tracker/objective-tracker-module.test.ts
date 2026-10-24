import { expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { ObjectiveTrackerModule } from "./objective-tracker-module";

it("routes controller objective events only during module lifetime", () => {
	const events = createTestEventBus();
	const client = { selectNext: vi.fn(), toggle: vi.fn() };
	const module = new ObjectiveTrackerModule(events, client);
	module.disableBuiltIn();
	module.initialize();
	events.emit("OBJECTIVE_NEXT_REQUESTED");
	events.emit("OBJECTIVE_TRACKER_TOGGLE_REQUESTED");
	expect(client.selectNext).toHaveBeenCalledOnce();
	expect(client.toggle).toHaveBeenCalledOnce();
	module.shutdown();
	events.emit("OBJECTIVE_NEXT_REQUESTED");
	events.emit("OBJECTIVE_TRACKER_TOGGLE_REQUESTED");
	expect(client.selectNext).toHaveBeenCalledOnce();
	expect(client.toggle).toHaveBeenCalledOnce();
});
