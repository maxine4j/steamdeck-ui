import { afterEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { type CursorSurface, NativeCursor } from "./native-cursor";

afterEach(() => vi.unstubAllGlobals());

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
		SetScript: vi.fn(),
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
	const tooltip = {
		GetOwner: vi.fn(),
		SetAnchorType: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		Hide: vi.fn(),
	};
	vi.stubGlobal("GameTooltip", tooltip);
	return {
		cursor: new NativeCursor(pool as unknown as IFramePoolManager),
		surface,
		overlay,
		pool,
		horizontal,
		vertical,
		tooltip,
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
	const tick = overlay.SetScript.mock.calls
		.find((call) => call.at(0) === "OnUpdate")
		?.at(1) as ((frame: unknown, elapsed: number) => void) | undefined;
	cursor.move("right", true);
	expect(cursor.position(surface)).toEqual([500, 400]);
	tick?.(overlay, 0.1);
	cursor.move("right", false);
	cursor.move("down", true);
	tick?.(overlay, 0.1);
	cursor.move("down", false);
	expect(cursor.position(surface)).toEqual([524, 376]);
	cursor.move("left", true);
	cursor.move("up", true);
	for (let i = 0; i < 100; i++) {
		tick?.(overlay, 0.1);
	}
	expect(cursor.position(surface)).toEqual([100, 600]);
	cursor.move("left", false);
	cursor.move("up", false);
	cursor.move("right", true);
	cursor.move("down", true);
	for (let i = 0; i < 100; i++) tick?.(overlay, 0.1);
	expect(cursor.position(surface)).toEqual([900, 200]);
	cursor.hide();
	expect(overlay.Hide).toHaveBeenCalled();
	cursor.show(surface);
	tick?.(overlay, 0.1);
	expect(cursor.position(surface)).toEqual([900, 200]);
	expect(pool.acquire).toHaveBeenCalledOnce();
	cursor.release();
	expect(pool.release).toHaveBeenCalledWith("Frame", overlay);
	cursor.show(surface);
	expect(cursor.position(surface)).toEqual([500, 400]);
});

it("enters and leaves native hover targets, anchors their tooltip at the crosshair and restores mouse queries", () => {
	const { cursor, surface, tooltip, overlay } = setup();
	const original = vi.fn(() => false);
	const target = {
		...surface,
		IsMouseOver: original,
		OnMouseEnter: vi.fn(),
		OnMouseLeave: vi.fn(),
	};
	cursor.show(surface);
	cursor.trackMouseOver(surface, target);
	expect(target.IsMouseOver()).toBe(true);
	tooltip.GetOwner.mockReturnValue(target);
	cursor.hover(target);
	cursor.hover(target);
	expect(target.OnMouseEnter).toHaveBeenCalledOnce();
	expect(tooltip.SetAnchorType).toHaveBeenCalledWith("ANCHOR_NONE");
	expect(tooltip.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		overlay,
		"TOPLEFT",
		416,
		-216,
	);
	cursor.hide();
	expect(target.OnMouseLeave).toHaveBeenCalledOnce();
	expect(target.IsMouseOver).toBe(original);
	expect(tooltip.Hide).toHaveBeenCalledOnce();
});

it("anchors provider-owned tooltips and clears them when leaving map navigation", () => {
	const { cursor, surface, tooltip, overlay } = setup();
	const blob = { ...surface, IsMouseOver: () => false };
	cursor.show(surface);
	cursor.trackMouseOver(surface, blob);
	tooltip.GetOwner.mockReturnValue(blob);
	cursor.hover();
	expect(tooltip.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		overlay,
		"TOPLEFT",
		416,
		-216,
	);
	cursor.hide();
	expect(tooltip.Hide).toHaveBeenCalledOnce();
});

it("clears a provider tooltip even when an overlapping icon held hover focus", () => {
	const { cursor, surface, tooltip } = setup();
	const icon = {
		...surface,
		IsMouseOver: () => false,
		OnMouseEnter: vi.fn(),
		OnMouseLeave: vi.fn(),
	};
	const provider = { ...surface, IsMouseOver: () => false };
	cursor.show(surface);
	cursor.trackMouseOver(surface, icon);
	cursor.trackMouseOver(surface, provider);
	cursor.hover(icon);
	tooltip.GetOwner.mockReturnValue(provider);
	cursor.hide();
	expect(tooltip.Hide).toHaveBeenCalled();
});

it("hit tests targets using effective scale and follows resized viewport dimensions", () => {
	const { cursor, surface, overlay } = setup();
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
	cursor.move("right", true);
	const tick = overlay.SetScript.mock.calls
		.find((call) => call.at(0) === "OnUpdate")
		?.at(1) as ((frame: unknown, elapsed: number) => void) | undefined;
	tick?.(overlay, 0.05);
	expect(cursor.contains(surface, target)).toBe(false);
	expect(
		cursor.position({ ...surface, GetWidth: () => 400, GetHeight: () => 200 }),
	).toEqual([306, 500]);
});
