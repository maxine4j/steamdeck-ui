import { expect, it, vi } from "vitest";
import type { WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import {
	drawScrollIndicator,
	type IndicatorScroll,
	NativeScrollIndicator,
} from "./scroll-indicator";

function setup() {
	const hooks = new Map<string, () => void>();
	const scroll = {
		GetHeight: () => 200,
		GetFrameLevel: () => 4,
		GetVerticalScrollRange: vi.fn(() => 600),
		GetVerticalScroll: vi.fn(() => 300),
		HookScript: (script: string, callback: () => void) =>
			hooks.set(script, callback),
	} as unknown as IndicatorScroll;
	const thumb = {
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetWidth: vi.fn(),
		SetHeight: vi.fn(),
		SetColorTexture: vi.fn(),
	} as unknown as WowTexture;
	const overlay = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		Show: vi.fn(),
	};
	const pool = {
		acquire: vi.fn(() => overlay),
		getDecoration: vi.fn(() => thumb),
		release: vi.fn(),
	};
	return { scroll, thumb, hooks, overlay, pool };
}

it("draws a thin proportional thumb and hides it when the viewport fits the content", () => {
	const { scroll, thumb } = setup();
	drawScrollIndicator(thumb, scroll);
	expect(thumb.SetWidth).toHaveBeenCalledWith(3);
	expect(thumb.SetHeight).toHaveBeenCalledWith(48);
	expect(thumb.SetPoint).toHaveBeenCalledWith(
		"TOPRIGHT",
		scroll,
		"TOPRIGHT",
		-3,
		-76,
	);
	expect(thumb.SetColorTexture).toHaveBeenCalledWith(1, 1, 1, 0.35);
	vi.mocked(scroll.GetVerticalScrollRange).mockReturnValue(0);
	drawScrollIndicator(thumb, scroll);
	expect(thumb.SetColorTexture).toHaveBeenLastCalledWith(1, 1, 1, 0);
});

it("updates on native scroll, range and size changes, reuses its frame and stops after release", () => {
	const { scroll, thumb, hooks, overlay, pool } = setup();
	const indicator = new NativeScrollIndicator(
		pool as unknown as IFramePoolManager,
	);
	indicator.bind(scroll);
	indicator.bind(scroll);
	expect(pool.acquire).toHaveBeenCalledOnce();
	expect(overlay.SetFrameLevel).toHaveBeenCalledWith(14);
	expect(overlay.EnableMouse).toHaveBeenCalledWith(false);
	vi.mocked(thumb.SetWidth).mockClear();
	for (const script of [
		"OnVerticalScroll",
		"OnScrollRangeChanged",
		"OnSizeChanged",
	])
		hooks.get(script)?.();
	expect(thumb.SetWidth).toHaveBeenCalledTimes(3);
	indicator.release();
	expect(pool.release).toHaveBeenCalledWith("Frame", overlay);
	hooks.get("OnVerticalScroll")?.();
	expect(thumb.SetWidth).toHaveBeenCalledTimes(3);
});
