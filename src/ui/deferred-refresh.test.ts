import { expect, it, vi } from "vitest";
import { DeferredRefresh } from "./deferred-refresh";

it("coalesces visible updates, caches reopening and cancels work while hidden", () => {
	const queue: (() => void)[] = [];
	const update = vi.fn();
	const refresh = new DeferredRefresh(
		{
			nextFrame: (callback) => {
				let cancelled = false;
				queue.push(() => {
					if (!cancelled) callback();
				});
				return () => {
					cancelled = true;
				};
			},
		},
		update,
	);
	refresh.invalidate();
	expect(queue).toHaveLength(0);
	refresh.setActive(true);
	refresh.invalidate();
	refresh.invalidate();
	expect(queue).toHaveLength(1);
	queue.shift()?.();
	expect(update).toHaveBeenCalledOnce();
	refresh.setActive(false);
	refresh.setActive(true);
	expect(queue).toHaveLength(0);
	refresh.invalidate();
	refresh.setActive(false);
	queue.shift()?.();
	expect(update).toHaveBeenCalledOnce();
	refresh.setActive(true);
	queue.shift()?.();
	expect(update).toHaveBeenCalledTimes(2);
});
