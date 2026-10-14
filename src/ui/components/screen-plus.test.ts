import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { ScreenPlus } from "./screen-plus";

afterEach(() => vi.unstubAllGlobals());

it("draws a pooled gold plus below panels and rings, tracks screen position, and releases cleanly", () => {
	const parent = { GetHeight: () => 1000 };
	vi.stubGlobal("UIParent", parent);
	const frame = {
		SetParent: vi.fn(),
		SetSize: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetScript: vi.fn(),
		Show: vi.fn(),
	};
	const bars = Array.from({ length: 2 }, () => ({
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetWidth: vi.fn(),
		SetHeight: vi.fn(),
		SetColorTexture: vi.fn(),
	}));
	const pool = {
		acquire: vi.fn(() => frame as unknown as WowFrame),
		getDecoration: vi.fn(() => bars.at(0) as unknown as WowTexture),
		release: vi.fn(),
	};
	pool.getDecoration
		.mockReturnValueOnce(bars.at(0) as unknown as WowTexture)
		.mockReturnValueOnce(bars.at(1) as unknown as WowTexture);
	let position = 0.6;
	const plus = new ScreenPlus(pool as unknown as IFramePoolManager);
	plus.show(14, [1, 0.82, 0.2], () => position);
	plus.show(14, [1, 0.82, 0.2], () => position);
	expect(pool.acquire).toHaveBeenCalledOnce();
	expect(frame.SetPoint).toHaveBeenLastCalledWith(
		"CENTER",
		parent,
		"BOTTOM",
		0,
		600,
	);
	expect(frame.SetFrameStrata).toHaveBeenCalledWith("BACKGROUND");
	expect(frame.SetFrameLevel).toHaveBeenCalledWith(0);
	expect(frame.EnableMouse).toHaveBeenCalledWith(false);
	expect(bars.at(0)?.SetWidth).toHaveBeenCalledWith(14);
	expect(bars.at(0)?.SetHeight).toHaveBeenCalledWith(2);
	expect(bars.at(1)?.SetWidth).toHaveBeenCalledWith(2);
	expect(bars.at(1)?.SetHeight).toHaveBeenCalledWith(14);
	for (const bar of bars)
		expect(bar.SetColorTexture).toHaveBeenCalledWith(1, 0.82, 0.2, 1);
	position = 0.4;
	const update = frame.SetScript.mock.calls
		.find((call) => call.at(0) === "OnUpdate")
		?.at(1);
	update(frame, 0.1);
	expect(frame.SetPoint).toHaveBeenLastCalledWith(
		"CENTER",
		parent,
		"BOTTOM",
		0,
		400,
	);
	plus.destroy();
	plus.destroy();
	expect(frame.SetScript).toHaveBeenLastCalledWith("OnUpdate", undefined);
	expect(pool.release).toHaveBeenCalledOnce();
});
