import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { setBorder } from "./border";
import {
	NativeNavigation,
	type NativeNavigationFrame,
	type NativeNavigationScroll,
} from "./native-navigation";

vi.mock("./border", () => ({ setBorder: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it("follows native left clicks without replacing scripts or accumulating hooks on refresh", () => {
	let over = true;
	const hooks = new Map<string, (frame: WowFrame, button: string) => void>();
	const frame = {
		IsMouseOver: () => over,
		HookScript: vi.fn((script, handler) => hooks.set(script, handler)),
	} as unknown as NativeNavigationFrame;
	const control = new NativeNavigation({} as IFramePoolManager);
	const activate = vi.fn();
	const first = control.navigation(frame, undefined, "first", activate);
	const focus = vi.fn();
	first.mouseTarget?.setNavigationFocus(focus);
	expect(hooks.get("OnMouseUp")).toBeTypeOf("function");
	hooks.get("OnMouseUp")?.(frame, "RightButton");
	expect(focus).not.toHaveBeenCalled();
	over = false;
	hooks.get("OnMouseUp")?.(frame, "LeftButton");
	expect(focus).not.toHaveBeenCalled();
	over = true;
	hooks.get("OnMouseUp")?.(frame, "LeftButton");
	expect(focus).toHaveBeenCalledOnce();
	expect(activate).not.toHaveBeenCalled();
	const refreshed = control.navigation(
		frame,
		undefined,
		"replacement",
		activate,
	);
	const next = vi.fn();
	refreshed.mouseTarget?.setNavigationFocus(next);
	hooks.get("OnMouseUp")?.(frame, "LeftButton");
	expect(next).toHaveBeenCalledOnce();
	expect(focus).toHaveBeenCalledOnce();
	control.release();
	hooks.get("OnMouseUp")?.(frame, "LeftButton");
	expect(next).toHaveBeenCalledOnce();
	expect(
		(frame as NativeNavigationFrame & { HookScript: ReturnType<typeof vi.fn> })
			.HookScript,
	).toHaveBeenCalledOnce();
});
it("anchors native hover tooltips to the icon and clears hover when navigation is released", () => {
	const outline = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
		SetSize: vi.fn(),
		SetScript: vi.fn(),
	};
	const pool = { acquire: vi.fn(() => outline), release: vi.fn() };
	const tooltip = {
		GetOwner: vi.fn(),
		SetAnchorType: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
	};
	vi.stubGlobal("GameTooltip", tooltip);
	let refreshOwner: (() => void) | undefined;
	vi.stubGlobal(
		"hooksecurefunc",
		(_target: unknown, _method: string, callback: () => void) => {
			refreshOwner = callback;
		},
	);
	const control = new NativeNavigation(pool as unknown as IFramePoolManager);
	const frame = { GetFrameLevel: () => 3 } as NativeNavigationFrame;
	tooltip.GetOwner.mockReturnValue(frame);
	const icon = { GetWidth: () => 32, GetHeight: () => 32 };
	const enter = vi.fn(),
		leave = vi.fn();
	const node = control.navigation(frame, undefined, "reward", vi.fn(), {
		enter,
		leave,
		anchor: icon,
	});
	node.onFocus();
	expect(enter).toHaveBeenCalledOnce();
	expect(tooltip.SetAnchorType).toHaveBeenCalledWith("ANCHOR_NONE");
	expect(tooltip.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		icon,
		"TOPRIGHT",
		8,
		0,
	);
	tooltip.SetPoint.mockClear();
	refreshOwner?.();
	expect(tooltip.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		icon,
		"TOPRIGHT",
		8,
		0,
	);
	control.release();
	tooltip.SetPoint.mockClear();
	refreshOwner?.();
	expect(tooltip.SetPoint).not.toHaveBeenCalled();
	expect(leave).toHaveBeenCalledOnce();
	node.onBlur();
	expect(leave).toHaveBeenCalledOnce();
});
it("reuses a pooled focus outline and scrolls the focused native row into view", () => {
	const outline = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
		SetSize: vi.fn(),
		SetScript:
			vi.fn<
				(
					script: string,
					callback?: (frame: unknown, elapsed: number) => void,
				) => void
			>(),
	};
	const pool = { acquire: vi.fn(() => outline), release: vi.fn() };
	const control = new NativeNavigation(pool as unknown as IFramePoolManager);
	const frame = {
		GetTop: () => 80,
		GetBottom: () => 40,
		GetFrameLevel: () => 3,
	} as NativeNavigationFrame;
	const scroll = {
		GetTop: () => 200,
		GetBottom: () => 100,
		GetVerticalScroll: () => 10,
		GetVerticalScrollRange: () => 300,
		SetVerticalScroll: vi.fn(),
	} as unknown as NativeNavigationScroll;
	const activate = vi.fn();
	const node = control.navigation(frame, scroll, "row", activate);
	node.onFocus();
	expect(setBorder).toHaveBeenLastCalledWith(
		pool,
		outline,
		[1, 0.82, 0, 1],
		2,
		"native-navigation",
		6,
	);
	outline.SetScript.mock.lastCall?.at(1)?.(outline, 0.18);
	expect(setBorder).toHaveBeenLastCalledWith(
		pool,
		outline,
		[1, 0.82, 0, 1],
		2,
		"native-navigation",
		0,
	);
	expect(scroll.SetVerticalScroll).toHaveBeenCalledWith(70);
	expect(outline.SetParent).toHaveBeenCalledWith(frame);
	expect(outline.EnableMouse).toHaveBeenCalledWith(false);
	node.onInteract();
	expect(activate).toHaveBeenCalledOnce();
	node.onBlur();
	expect(outline.Hide).toHaveBeenCalled();
	node.onFocus();
	expect(
		pool.acquire.mock.calls.filter((call) => call.at(0) === "Frame"),
	).toHaveLength(1);
	control.release();
	expect(outline.SetFrameLevel).toHaveBeenLastCalledWith(0);
	expect(pool.release).toHaveBeenCalledWith("Frame", outline);
});

it("focuses a native control without requiring a scroll viewport", () => {
	const outline = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
		SetSize: vi.fn(),
		SetScript: vi.fn(),
	};
	const pool = { acquire: vi.fn(() => outline), release: vi.fn() };
	const control = new NativeNavigation(pool as unknown as IFramePoolManager);
	const frame = { GetFrameLevel: () => 3 } as NativeNavigationFrame;
	const node = control.navigation(frame, undefined, "talent", vi.fn());
	node.onFocus();
	expect(outline.SetParent).toHaveBeenCalledWith(frame);
	expect(outline.Show).toHaveBeenCalled();
	node.onBlur();
	expect(outline.Hide).toHaveBeenCalled();
	control.release();
});
