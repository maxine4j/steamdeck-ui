import { beforeEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { SkyridingBar } from "./skyriding-bar";

const { frames } = vi.hoisted(() => ({
	frames: new Map<
		string,
		{
			layout: ReturnType<typeof vi.fn>;
			setParent: ReturnType<typeof vi.fn>;
			setColor: ReturnType<typeof vi.fn>;
			setBorder: ReturnType<typeof vi.fn>;
			setLabel: ReturnType<typeof vi.fn>;
			show: ReturnType<typeof vi.fn>;
			hide: ReturnType<typeof vi.fn>;
			destroy: ReturnType<typeof vi.fn>;
		}
	>(),
}));
vi.mock("../../ui/components/frame", () => ({
	Frame: class {
		layout = vi.fn();
		setParent = vi.fn();
		setColor = vi.fn();
		setBorder = vi.fn();
		setLabel = vi.fn();
		show = vi.fn();
		hide = vi.fn();
		destroy = vi.fn();
		constructor(id: string) {
			frames.set(id, this);
		}
	},
}));
beforeEach(() => frames.clear());
const state = { active: true, speed: 65, cruisingSpeed: 65, maximumSpeed: 100 };

it("places the bar just above the cross bar, marking cruising maximum with room for boost", () => {
	const bar = new SkyridingBar({} as IFramePoolManager);
	bar.render(state);
	const track = frames.get("skyriding-track");
	expect(track?.layout).toHaveBeenCalledWith(
		304,
		14,
		"BOTTOM",
		undefined,
		0,
		168,
	);
	expect(frames.get("skyriding-cruise")?.layout).toHaveBeenLastCalledWith(
		195,
		10,
		"TOPLEFT",
		track,
		2,
		-2,
	);
	expect(frames.get("skyriding-marker")?.layout).toHaveBeenLastCalledWith(
		2,
		18,
		"TOPLEFT",
		track,
		196,
		2,
	);
	expect(frames.get("skyriding-boost")?.hide).toHaveBeenCalled();
	bar.render({ ...state, speed: 80 });
	expect(frames.get("skyriding-boost")?.layout).toHaveBeenLastCalledWith(
		45,
		10,
		"TOPLEFT",
		track,
		197,
		-2,
	);
	expect(frames.get("skyriding-boost")?.show).toHaveBeenCalled();
});

it("keeps boost headroom and cruising marker proportional in reduced zones and beyond the expected cap", () => {
	const bar = new SkyridingBar({} as IFramePoolManager);
	bar.render({ ...state, speed: 85, cruisingSpeed: 55.25, maximumSpeed: 85 });
	expect(frames.get("skyriding-cruise")?.layout.mock.calls.at(-1)?.at(0)).toBe(
		195,
	);
	expect(frames.get("skyriding-boost")?.layout.mock.calls.at(-1)?.at(0)).toBe(
		105,
	);
	bar.render({ ...state, speed: 130 });
	expect(frames.get("skyriding-cruise")?.layout.mock.calls.at(-1)?.at(0)).toBe(
		150,
	);
	expect(frames.get("skyriding-boost")?.layout.mock.calls.at(-1)?.at(0)).toBe(
		150,
	);
	expect(frames.get("skyriding-track")?.setLabel).toHaveBeenLastCalledWith(
		"speed",
		"130 yd/s",
		"TOP",
		0,
		18,
		12,
	);
});

it("reuses controls across hiding and flight updates and releases every component on shutdown", () => {
	const bar = new SkyridingBar({} as IFramePoolManager);
	bar.hide();
	bar.render(state);
	const original = [...frames.values()];
	bar.hide();
	bar.render({ ...state, speed: 0 });
	expect([...frames.values()]).toEqual(original);
	expect(frames.get("skyriding-cruise")?.hide).toHaveBeenCalled();
	bar.destroy();
	for (const frame of original) expect(frame.destroy).toHaveBeenCalledOnce();
});
