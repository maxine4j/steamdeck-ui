import { afterEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { type LayoutFrame, NativeLayout } from "./native-layout";

afterEach(() => vi.unstubAllGlobals());

it("keeps an anchored native child above its host background without changing its script parent, then restores its level", () => {
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		vi.fn((_frame: unknown, method: string, callback: () => void) =>
			hooks.set(method, callback),
		),
	);
	const owner = {};
	let hostLevel = 20;
	const host = new Frame("host", {
		acquire: () => ({ GetFrameLevel: () => hostLevel }),
		getBackground: () => ({}),
	} as unknown as IFramePoolManager);
	const native = {
		GetParent: () => owner,
		GetNumPoints: () => 0,
		GetSize: () => [300, 400],
		GetScale: () => 1,
		GetFrameStrata: () => "DIALOG",
		GetAlpha: () => 1,
		IsShown: () => true,
		GetFrameLevel: () => 3,
		SetFrameLevel: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		SetScale: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetAlpha: vi.fn(),
	} as unknown as LayoutFrame;
	const layout = new NativeLayout();
	layout.bind(native, { parent: host, levelOffset: 1 });
	expect(native.SetFrameLevel).toHaveBeenLastCalledWith(21);
	expect(native.SetParent).not.toHaveBeenCalled();
	hooks.get("SetFrameLevel")?.();
	expect(native.SetFrameLevel).toHaveBeenCalledTimes(2);
	hostLevel = 30;
	hooks.get("Raise")?.();
	expect(native.SetFrameLevel).toHaveBeenLastCalledWith(31);
	layout.release();
	expect(native.SetFrameLevel).toHaveBeenLastCalledWith(3);
	hooks.get("SetFrameLevel")?.();
	expect(native.SetFrameLevel).toHaveBeenCalledTimes(4);
});

it("owns anchors across native rewrites, keeps hooks inert after release, and restores original layout", () => {
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		vi.fn((_frame: unknown, method: string, callback: () => void) =>
			hooks.set(method, callback),
		),
	);
	const originalParent = {};
	const frame = {
		GetParent: () => originalParent,
		GetNumPoints: () => 1,
		GetPoint: () => ["CENTER", originalParent, "CENTER", 12, 34],
		GetSize: () => [700, 500],
		GetScale: () => 0.8,
		GetFrameStrata: () => "HIGH",
		GetAlpha: () => 0.6,
		IsShown: () => true,
		IsMouseEnabled: () => true,
		EnableMouse: vi.fn(),
		DoesClipChildren: () => false,
		SetClipsChildren: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		SetScale: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetAlpha: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	} as unknown as LayoutFrame;
	const parent = {} as LayoutFrame;
	const layout = new NativeLayout();
	layout.bind(frame, {
		parent,
		insets: [0, 48, 420, 0],
		reparent: true,
		strata: "DIALOG",
		scale: 1,
	});
	expect(frame.SetPoint).toHaveBeenLastCalledWith(
		"BOTTOMRIGHT",
		parent,
		"BOTTOMRIGHT",
		-420,
		0,
	);
	vi.mocked(frame.SetPoint).mockClear();
	hooks.get("SetPoint")?.();
	expect(frame.SetPoint).toHaveBeenCalledTimes(2);
	layout.release();
	// Geometry ownership must not reopen a frame which Blizzard just closed.
	expect(frame.Show).not.toHaveBeenCalled();
	expect(frame.SetParent).toHaveBeenLastCalledWith(originalParent);
	expect(frame.SetPoint).toHaveBeenLastCalledWith(
		"CENTER",
		originalParent,
		"CENTER",
		12,
		34,
	);
	expect(frame.SetSize).toHaveBeenLastCalledWith(700, 500);
	expect(frame.SetScale).toHaveBeenLastCalledWith(0.8);
	vi.mocked(frame.SetPoint).mockClear();
	hooks.get("SetPoint")?.();
	expect(frame.SetPoint).not.toHaveBeenCalled();
	// Reopening reuses the installed hooks rather than stacking closures.
	layout.bind(frame, { parent, visible: false });
	expect(frame.Hide).toHaveBeenCalled();
	hooks.get("Show")?.();
	expect(frame.Hide).toHaveBeenCalledTimes(2);
	expect(
		vi
			.mocked(hooksecurefunc)
			.mock.calls.filter((call) => call.at(1) === "Show"),
	).toHaveLength(1);
	layout.bind(frame, {
		parent,
		anchors: [
			["TOPLEFT", "TOPLEFT", 0, 0],
			["BOTTOMRIGHT", "TOPRIGHT", -420, -48],
		],
	});
	expect(frame.SetPoint).toHaveBeenLastCalledWith(
		"BOTTOMRIGHT",
		parent,
		"TOPRIGHT",
		-420,
		-48,
	);
	layout.bind(frame, {
		parent,
		anchors: [["TOPLEFT", "TOPLEFT", 0, -48]],
		size: [780, 520],
		mouse: false,
		clip: true,
	});
	expect(frame.SetSize).toHaveBeenLastCalledWith(780, 520);
	expect(frame.EnableMouse).toHaveBeenLastCalledWith(false);
	expect(frame.SetClipsChildren).toHaveBeenLastCalledWith(true);
	layout.release();
	expect(frame.EnableMouse).toHaveBeenLastCalledWith(true);
	expect(frame.SetClipsChildren).toHaveBeenLastCalledWith(false);
});

it("routes reading actions through the native scroll control", () => {
	const bar = { ScrollStepInDirection: vi.fn() };
	const layout = new NativeLayout();
	layout.scroll(bar, 1);
	layout.scroll(bar, -1);
	expect(bar.ScrollStepInDirection.mock.calls).toEqual([[1], [-1]]);
});
