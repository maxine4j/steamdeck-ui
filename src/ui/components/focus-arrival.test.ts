import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("expands only the focus outline symmetrically and settles to its original bounds", () => {
	const textures: ReturnType<typeof texture>[] = [];
	function texture() {
		const result = {
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetColorTexture: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetHeight: vi.fn(),
			SetWidth: vi.fn(),
		};
		textures.push(result);
		return result;
	}
	const natives: ReturnType<typeof native>[] = [];
	function native() {
		return {
			Hide: vi.fn(),
			Show: vi.fn(),
			SetParent: vi.fn(),
			SetSize: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			CreateTexture: texture,
			SetScript:
				vi.fn<
					(
						script: string,
						callback?: (frame: WowFrame, elapsed: number) => void,
					) => void
				>(),
		};
	}
	const factory = vi.fn(() => {
		const frame = native();
		natives.push(frame);
		return frame as unknown as WowFrame;
	});
	const pool = new FramePoolManager({ createFrame: factory });
	const control = new Frame("control", pool);
	control.setFocused(true);
	const edge = textures.at(1);
	expect(edge?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		natives.at(0),
		"TOPLEFT",
		-6,
		6,
	);
	expect(edge?.SetPoint).toHaveBeenCalledWith(
		"TOPRIGHT",
		natives.at(0),
		"TOPRIGHT",
		6,
		6,
	);
	expect(natives.at(0)?.SetSize).not.toHaveBeenCalled();
	const timer = natives.at(1);
	const tick = timer?.SetScript.mock.lastCall?.at(1);
	expect(tick).toBeTypeOf("function");
	const starts = timer?.SetScript.mock.calls.length;
	control.setFocused(true);
	expect(timer?.SetScript.mock.calls.length).toBe(starts);
	tick?.(timer as unknown as WowFrame, 0.09);
	expect(edge?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		natives.at(0),
		"TOPLEFT",
		-1.5,
		1.5,
	);
	tick?.(timer as unknown as WowFrame, 0.09);
	expect(edge?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		natives.at(0),
		"TOPLEFT",
		0,
		0,
	);
	expect(timer?.SetScript).toHaveBeenLastCalledWith("OnUpdate", undefined);
	control.setFocused(false);
	control.setFocused(true, false, true);
	expect(timer?.SetScript).toHaveBeenLastCalledWith("OnUpdate", undefined);
	control.setFocused(false);
	control.setFocused(true);
	expect(factory).toHaveBeenCalledTimes(2);
	expect(timer?.SetScript.mock.lastCall?.at(1)).toBeTypeOf("function");
	control.hide();
	expect(timer?.SetScript).toHaveBeenLastCalledWith("OnUpdate", undefined);
	control.setFocused(true);
	control.destroy();
	expect(timer?.SetScript).toHaveBeenLastCalledWith("OnUpdate", undefined);
	expect(timer?.SetParent).toHaveBeenLastCalledWith(undefined);
});
