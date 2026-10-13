import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { type CursorSurface, NativeCursor } from "./native-cursor";

function setup() {
	const overlay = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	};
	const texture = () => ({
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetWidth: vi.fn(),
		SetHeight: vi.fn(),
		SetColorTexture: vi.fn(),
	});
	const horizontal = texture(),
		vertical = texture();
	const pool = {
		acquire: vi.fn(() => overlay),
		release: vi.fn(),
		getDecoration: vi.fn((_frame, key) =>
			key === "cursor-horizontal" ? horizontal : vertical,
		),
	};
	const surface = {
		GetLeft: () => 100,
		GetTop: () => 600,
		GetWidth: () => 800,
		GetHeight: () => 400,
		GetEffectiveScale: () => 1,
		GetFrameLevel: () => 5,
	} as CursorSurface;
	return {
		cursor: new NativeCursor(pool as unknown as IFramePoolManager),
		surface,
		overlay,
		pool,
		horizontal,
		vertical,
	};
}

it("draws full viewport crosshairs, clamps D-pad movement and reuses its pooled overlay", () => {
	const { cursor, surface, overlay, pool, horizontal, vertical } = setup();
	cursor.show(surface);
	expect(cursor.position(surface)).toEqual([500, 400]);
	expect(horizontal.SetPoint.mock.calls).toEqual([
		["LEFT", overlay, "TOPLEFT", 0, -200],
		["RIGHT", overlay, "TOPRIGHT", 0, -200],
	]);
	expect(vertical.SetPoint.mock.calls).toEqual([
		["TOP", overlay, "TOPLEFT", 400, 0],
		["BOTTOM", overlay, "BOTTOMLEFT", 400, 0],
	]);
	expect(overlay.EnableMouse).toHaveBeenCalledWith(false);
	cursor.move("right");
	cursor.move("down");
	expect(cursor.position(surface)).toEqual([508, 396]);
	for (let i = 0; i < 100; i++) {
		cursor.move("left");
		cursor.move("up");
	}
	expect(cursor.position(surface)).toEqual([100, 600]);
	for (let i = 0; i < 100; i++) {
		cursor.move("right");
		cursor.move("down");
	}
	expect(cursor.position(surface)).toEqual([900, 200]);
	cursor.hide();
	expect(overlay.Hide).toHaveBeenCalled();
	cursor.show(surface);
	expect(pool.acquire).toHaveBeenCalledOnce();
	cursor.release();
	expect(pool.release).toHaveBeenCalledWith("Frame", overlay);
	cursor.show(surface);
	expect(cursor.position(surface)).toEqual([500, 400]);
});

it("hit tests targets using effective scale and follows resized viewport dimensions", () => {
	const { cursor, surface } = setup();
	const target = {
		...surface,
		GetLeft: () => 248,
		GetTop: () => 205,
		GetWidth: () => 4,
		GetHeight: () => 10,
		GetEffectiveScale: () => 2,
	};
	cursor.show(surface);
	expect(cursor.contains(surface, target)).toBe(true);
	cursor.move("right");
	expect(cursor.contains(surface, target)).toBe(false);
	expect(
		cursor.position({ ...surface, GetWidth: () => 400, GetHeight: () => 200 }),
	).toEqual([304, 500]);
});
