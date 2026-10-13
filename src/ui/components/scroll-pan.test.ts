import { expect, it, vi } from "vitest";
import { ScrollPan } from "./scroll-pan";

function setup() {
	let offset = 100;
	let pointer = { down: false, over: true, y: 100, scale: 2 };
	const write = vi.fn((value: number) => {
		offset = value;
	});
	const pan = new ScrollPan(
		() => pointer,
		() => ({ offset, range: 500 }),
		write,
	);
	return {
		pan,
		write,
		offset: () => offset,
		pointer: (value: Partial<typeof pointer>) => {
			pointer = { ...pointer, ...value };
		},
	};
}

it("moves content with the finger in UI units and ignores jitter and taps", () => {
	const s = setup();
	s.pointer({ down: true });
	s.pan.update(0.016);
	s.pointer({ y: 108 });
	s.pan.update(0.016);
	expect(s.write).not.toHaveBeenCalled();
	s.pointer({ y: 140 });
	s.pan.update(0.016);
	expect(s.offset()).toBe(120);
	expect(s.pan.suppressClick()).toBe(true);
	s.pointer({ down: false });
	s.pan.update(0.016);
	s.pointer({ down: true });
	s.pan.update(0.016);
	s.pointer({ down: false });
	s.pan.update(0.016);
	expect(s.pan.suppressClick()).toBe(false);
});

it("coasts after a swipe and clamps at the edges without bouncing", () => {
	const s = setup();
	s.pointer({ down: true });
	s.pan.update(0.016);
	s.pointer({ y: 180 });
	s.pan.update(0.016);
	s.pointer({ down: false });
	s.pan.update(0.016);
	const released = s.offset();
	s.pan.update(0.016);
	expect(s.offset()).toBeGreaterThan(released);
	for (let i = 0; i < 100; i++) s.pan.update(0.016);
	expect(s.offset()).toBeLessThanOrEqual(500);
	s.pointer({ down: true, y: 100 });
	s.pan.update(0.016);
	s.pointer({ y: -2000 });
	s.pan.update(0.016);
	expect(s.offset()).toBe(0);
	s.pointer({ down: false });
	s.pan.update(0.016);
	s.pan.update(0.016);
	expect(s.offset()).toBe(0);
});

it("does not capture presses outside the viewport and resets gestures and momentum", () => {
	const s = setup();
	s.pointer({ down: true, over: false });
	s.pan.update(0.016);
	s.pointer({ over: true, y: 400 });
	s.pan.update(0.016);
	expect(s.write).not.toHaveBeenCalled();
	s.pointer({ down: false });
	s.pan.update(0.016);
	s.pointer({ down: true });
	s.pan.update(0.016);
	s.pointer({ y: 480 });
	s.pan.update(0.016);
	s.pan.reset();
	const stopped = s.offset();
	s.pan.update(0.016);
	expect(s.offset()).toBe(stopped);
	expect(s.pan.suppressClick()).toBe(false);
});
