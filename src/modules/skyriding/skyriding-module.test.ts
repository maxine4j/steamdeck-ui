import { expect, it, vi } from "vitest";
import type { SkyridingState } from "../../clients/skyriding-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { SkyridingModule } from "./skyriding-module";

function setup(active = false) {
	let state: SkyridingState = {
		active,
		speed: 55.25,
		cruisingSpeed: 55.25,
		maximumSpeed: 85,
	};
	const read = vi.fn(() => state);
	const view = { render: vi.fn(), hide: vi.fn(), destroy: vi.fn() };
	const pending: { callback: () => void; cancelled: boolean }[] = [];
	const scheduler = {
		nextFrame: vi.fn(),
		delay: vi.fn((_seconds: number, callback: () => void) => {
			const task = { callback, cancelled: false };
			pending.push(task);
			return () => {
				task.cancelled = true;
			};
		}),
	};
	const events = createTestEventBus();
	const module = new SkyridingModule({ read }, view, events, scheduler);
	return {
		module,
		read,
		view,
		scheduler,
		events,
		pending,
		setState: (next: Partial<SkyridingState>) => {
			state = { ...state, ...next };
		},
	};
}

it("stays hidden with no polling until active skyriding starts", () => {
	const { module, view, scheduler, events, setState } = setup();
	module.initialize();
	expect(view.hide).toHaveBeenCalledOnce();
	expect(view.render).not.toHaveBeenCalled();
	expect(scheduler.delay).not.toHaveBeenCalled();
	setState({ active: true });
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(view.render).toHaveBeenCalledWith(
		expect.objectContaining({ active: true }),
	);
	expect(scheduler.delay).toHaveBeenCalledWith(0.05, expect.any(Function));
});

it("updates speed through boost and stops immediately on landing without multiplying timers", () => {
	const { module, pending, view, events, setState } = setup(true);
	module.initialize();
	setState({ speed: 80 });
	pending.shift()?.callback();
	expect(view.render).toHaveBeenLastCalledWith(
		expect.objectContaining({ speed: 80 }),
	);
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(pending.filter((task) => !task.cancelled)).toHaveLength(1);
	setState({ active: false });
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(view.hide).toHaveBeenCalledOnce();
	expect(pending.every((task) => task.cancelled)).toBe(true);
});

it("hides during loading and cancels work and subscriptions on shutdown, then restarts", () => {
	const { module, pending, view, events, read } = setup(true);
	module.initialize();
	events.emit("SKYRIDING_SUSPENDED");
	expect(view.hide).toHaveBeenCalledOnce();
	expect(pending.every((task) => task.cancelled)).toBe(true);
	events.emit("SKYRIDING_STATE_CHANGED");
	module.shutdown();
	expect(view.destroy).toHaveBeenCalledOnce();
	read.mockClear();
	events.emit("SKYRIDING_STATE_CHANGED");
	expect(read).not.toHaveBeenCalled();
	module.initialize();
	expect(read).toHaveBeenCalledOnce();
});
