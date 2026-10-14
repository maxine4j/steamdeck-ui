import { afterEach, expect, it, vi } from "vitest";
import { TaskScheduler } from "./task-scheduler";

afterEach(() => vi.unstubAllGlobals());

it("schedules a cancellable task after the requested delay", () => {
	const pending: (() => void)[] = [];
	const after = vi.fn((_seconds: number, callback: () => void) =>
		pending.push(callback),
	);
	vi.stubGlobal("C_Timer", { After: after });
	const scheduler = new TaskScheduler();
	const run = vi.fn();
	const cancelled = vi.fn();
	scheduler.delay(0.3, run);
	scheduler.delay(0.3, cancelled)();
	expect(after).toHaveBeenCalledWith(0.3, expect.any(Function));
	expect(run).not.toHaveBeenCalled();
	for (const callback of pending) callback();
	expect(run).toHaveBeenCalledOnce();
	expect(cancelled).not.toHaveBeenCalled();
});

it("defers work to a frame callback and cancels pending work", () => {
	const pending: (() => void)[] = [];
	vi.stubGlobal("C_Timer", {
		After: (delay: number, callback: () => void) => {
			expect(delay).toBe(0);
			pending.push(callback);
		},
	});
	const scheduler = new TaskScheduler();
	const run = vi.fn();
	const cancelled = vi.fn();
	scheduler.nextFrame(run);
	scheduler.nextFrame(cancelled)();
	expect(run).not.toHaveBeenCalled();
	for (const callback of pending) callback();
	expect(run).toHaveBeenCalledOnce();
	expect(cancelled).not.toHaveBeenCalled();
});
