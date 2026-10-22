import { expect, it, vi } from "vitest";
import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { NativeMarkers } from "./native-markers";
import type { NativeNavigationFrame } from "./native-navigation";

it("reuses pooled overlays, clears badges on recycled targets, and restores native artwork on release", () => {
	const texture = () => ({
		SetAtlas: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	});
	const icon = texture();
	const badge = texture();
	const frame = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	};
	const pool = {
		acquire: vi.fn(() => frame as unknown as WowFrame),
		release: vi.fn(),
		getDecoration: vi.fn(
			(_frame, key) =>
				(key === "marker" ? icon : badge) as unknown as WowTexture,
		),
	} as unknown as IFramePoolManager;
	const original = { IsShown: () => true, Show: vi.fn(), Hide: vi.fn() };
	const hiddenOriginal = { IsShown: () => false, Show: vi.fn(), Hide: vi.fn() };
	const owner = { GetFrameLevel: () => 5 } as NativeNavigationFrame;
	const markers = new NativeMarkers(pool);
	markers.sync([
		{
			owner,
			replace: [original, hiddenOriginal],
			atlas: "mythic",
			size: 36,
			badge: { atlas: "bang", size: 14, x: 20 },
		},
	]);
	expect(pool.acquire).toHaveBeenCalledTimes(1);
	expect(icon.SetAtlas).toHaveBeenLastCalledWith("mythic", false);
	expect(badge.Show).toHaveBeenCalledOnce();
	expect(original.Hide).toHaveBeenCalledOnce();
	markers.sync([
		{ owner, replace: [original, hiddenOriginal], atlas: "normal", size: 36 },
	]);
	expect(pool.acquire).toHaveBeenCalledTimes(1);
	expect(icon.SetAtlas).toHaveBeenLastCalledWith("normal", false);
	expect(badge.Hide).toHaveBeenCalled();
	markers.sync([]);
	expect(original.Show).toHaveBeenCalledOnce();
	expect(hiddenOriginal.Show).not.toHaveBeenCalled();
	expect(pool.release).toHaveBeenCalledWith("Frame", frame);
	markers.release();
	expect(pool.release).toHaveBeenCalledTimes(1);
});
