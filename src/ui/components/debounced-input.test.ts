import { afterEach, expect, it, vi } from "vitest";
import { DebouncedInput } from "./debounced-input";

afterEach(() => vi.useRealTimers());

function setup() {
	vi.useFakeTimers();
	const changed = vi.fn();
	const input = new DebouncedInput(
		{
			nextFrame: vi.fn(),
			delay: (seconds, callback) => {
				const timer = setTimeout(callback, seconds * 1000);
				return () => clearTimeout(timer);
			},
		},
		changed,
	);
	return { input, changed };
}

it("waits for 300ms of inactivity and publishes only the latest text, including clearing", () => {
	const { input, changed } = setup();
	input.change("c");
	vi.advanceTimersByTime(250);
	input.change("ca");
	vi.advanceTimersByTime(250);
	input.change("cat");
	vi.advanceTimersByTime(299);
	expect(changed).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(changed).toHaveBeenCalledExactlyOnceWith("cat");
	input.change("");
	vi.advanceTimersByTime(300);
	expect(changed).toHaveBeenLastCalledWith("");
});

it("cancels work on closing and resumes the unsent text after reopening", () => {
	const { input, changed } = setup();
	input.change("cat");
	vi.advanceTimersByTime(200);
	input.cancel();
	vi.advanceTimersByTime(1000);
	expect(changed).not.toHaveBeenCalled();
	input.resume();
	vi.advanceTimersByTime(299);
	expect(changed).not.toHaveBeenCalled();
	vi.advanceTimersByTime(1);
	expect(changed).toHaveBeenCalledExactlyOnceWith("cat");
});
