import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ScrollText } from "./scroll-text";

const state = vi.hoisted(() => ({ offset: 0, created: 0, labels: vi.fn() }));
vi.mock("./frame", () => ({
	Frame: class {
		constructor() {
			state.created++;
		}
		setParent = vi.fn();
		layout = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		setLabel = state.labels;
		setLabelStyle = vi.fn();
		setLabelWordWrap = vi.fn();
		setScrollContent = vi.fn();
		clampScroll = vi.fn();
		labelHeight = () => 2000;
		resetScroll = () => {
			state.offset = 0;
		};
		scrollBy = (delta: number) => {
			state.offset = Math.max(0, Math.min(1600, state.offset + delta));
			return { offset: state.offset, range: 1600 };
		};
		setFocused = vi.fn();
	},
}));
it("leaves prose to mouse scrolling, preserves reading on refresh and reuses its frames", () => {
	state.labels.mockClear();
	state.offset = 300;
	state.created = 0;
	const reader = new ScrollText("read", {} as IFramePoolManager);
	reader.mount(new Frame("parent", {} as IFramePoolManager), 450, 400);
	expect("node" in reader).toBe(false);
	reader.setText("Updated text", false);
	expect(state.offset).toBe(300);
	expect(
		state.labels.mock.calls.some((call) => call.at(0) === "position"),
	).toBe(false);
	reader.setText("New quest", true);
	expect(state.offset).toBe(0);
	const count = state.created;
	reader.unmount();
	reader.mount(new Frame("parent2", {} as IFramePoolManager), 450, 400);
	expect(state.created).toBe(count + 1);
});
