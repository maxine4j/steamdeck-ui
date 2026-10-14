import { afterEach, expect, it, vi } from "vitest";
import type { IActionBarClient } from "../../clients/action-bar-client";
import { Frame } from "../../ui/components/frame";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import { CrossBarPreview } from "./cross-bar-preview";

afterEach(() => vi.restoreAllMocks());
it("stacks all four gameplay layouts at 80% scale, reads each modifier page and reuses the controls", () => {
	for (const method of [
		"setParent",
		"setModalLayer",
		"layout",
		"setScale",
		"setColor",
		"setIcon",
		"setAtlasBackground",
		"setIconOutline",
		"setLabel",
		"show",
		"hide",
		"destroy",
	] as const)
		vi.spyOn(Frame.prototype, method).mockImplementation(() => {});
	const pool = {} as IFramePoolManager;
	const readPreview = vi.fn((slot: number) => ({ icon: slot }));
	const preview = new CrossBarPreview(pool, {
		readPreview,
	} as unknown as IActionBarClient);
	const parent = new Frame("backdrop", pool);
	preview.show(parent, -123);
	expect(Frame.prototype.setScale).toHaveBeenCalledWith(0.8);
	expect(preview.width).toBe(448);
	expect(preview.height).toBeCloseTo(422.4);
	expect(Frame.prototype.layout).toHaveBeenCalledWith(
		448,
		preview.height,
		"CENTER",
		parent,
		0,
		-123,
	);
	for (const [index, modifier] of [
		"none",
		"shift",
		"ctrl",
		"ctrl-shift",
	].entries()) {
		expect(Frame.prototype.setLabel).toHaveBeenCalledWith(
			"modifier",
			["No modifier", "LT", "LB", "LT+LB"].at(index),
			"TOP",
			0,
			0,
			18,
		);
		expect(readPreview).toHaveBeenCalledWith(1, modifier, undefined);
	}
	const calls = vi.mocked(Frame.prototype.layout).mock;
	const xButton = calls.contexts.findIndex(
		(frame) => frame.id === "cross-bar-preview-0-PAD3",
	);
	expect(calls.calls.at(xButton)?.slice(0, 3)).toEqual([48, 48, "CENTER"]);
	expect(calls.calls.at(xButton)?.slice(-2)).toEqual([150, 0]);
	const firstControls = new Set(
		vi.mocked(Frame.prototype.setIcon).mock.contexts,
	);
	preview.hide();
	preview.show(parent, -123);
	expect(new Set(vi.mocked(Frame.prototype.setIcon).mock.contexts)).toEqual(
		firstControls,
	);
	preview.destroy();
	expect(Frame.prototype.destroy).toHaveBeenCalled();
});
