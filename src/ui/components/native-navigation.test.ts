import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { setBorder } from "./border";
import {
	NativeNavigation,
	type NativeNavigationFrame,
	type NativeNavigationScroll,
} from "./native-navigation";

vi.mock("./border", () => ({ setBorder: vi.fn() }));
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
