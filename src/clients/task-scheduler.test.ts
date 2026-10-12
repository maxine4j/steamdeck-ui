import { afterEach, expect, it, vi } from "vitest";
import { TaskScheduler } from "./task-scheduler";

afterEach(() => vi.unstubAllGlobals());

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
