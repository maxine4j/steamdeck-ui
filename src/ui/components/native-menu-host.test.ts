import { afterEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import type { NativeDialogFrame } from "./native-dialog-navigation";
import { NativeMenuHost } from "./native-menu-host";

afterEach(() => vi.unstubAllGlobals());

it("prepares reusable hardware actions outside combat and defers their destruction during combat", () => {
	const combat = vi.fn(() => false);
	vi.stubGlobal("InCombatLockdown", combat);
	const native = {
		Hide: vi.fn(),
		Show: vi.fn(),
		RegisterForClicks: vi.fn(),
		SetAttribute: vi.fn(),
		SetScript: vi.fn(),
	};
	const pool = {
		acquire: vi.fn(() => native),
		getBackground: () => ({ SetAllPoints: vi.fn() }),
	};
	const host = new NativeMenuHost(pool as unknown as IFramePoolManager);
	const clicked = vi.fn();
	host.prepareAction("focus", "focus", "player", clicked);
	host.prepareAction("focus", "focus", "player", clicked);
	expect(pool.acquire).toHaveBeenCalledOnce();
	expect(native.SetAttribute).toHaveBeenCalledWith("type", "focus");
	expect(host.getAction("focus")).toBeDefined();
	const destroy = vi
		.spyOn(Frame.prototype, "destroy")
		.mockImplementation(() => {});
	combat.mockReturnValue(true);
	host.prepareAction("vehicle", "leavevehicle", undefined, clicked);
	expect(host.getAction("vehicle")).toBeUndefined();
	expect(host.destroy()).toBe(false);
	expect(destroy).not.toHaveBeenCalled();
	combat.mockReturnValue(false);
	expect(host.destroy()).toBe(true);
	expect(destroy).toHaveBeenCalledOnce();
	destroy.mockRestore();
});

it("reuses a pooled metal window behind the native menu and restores native chrome on release", () => {
	const texture = {
		ClearAllPoints: vi.fn(),
		SetAtlas: vi.fn(),
		SetPoint: vi.fn(),
	};
	const border = {
		SetParent: vi.fn(),
		SetFrameStrata: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		Show: vi.fn(),
		SetFrameLevel: vi.fn(),
		EnableMouse: vi.fn(),
	};
	const pool = {
		acquire: vi.fn(() => border),
		release: vi.fn(),
		getBackground: () => texture,
		getDecoration: () => texture,
	};
	const menu = {
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		GetFrameLevel: () => 100,
		NineSlice: { GetAlpha: () => 0.8, SetAlpha: vi.fn() },
	};
	const owner = {};
	const host = new NativeMenuHost(pool as unknown as IFramePoolManager);
	host.place(menu as unknown as NativeDialogFrame, owner as NativeDialogFrame);
	host.place(menu as unknown as NativeDialogFrame, owner as NativeDialogFrame);
	expect(pool.acquire).toHaveBeenCalledOnce();
	expect(menu.SetPoint).toHaveBeenCalledWith(
		"TOPRIGHT",
		owner,
		"TOPLEFT",
		-24,
		0,
	);
	expect(border.SetFrameLevel).toHaveBeenCalledWith(99);
	expect(border.EnableMouse).toHaveBeenCalledWith(false);
	expect(menu.NineSlice.SetAlpha).toHaveBeenCalledWith(0);
	host.release();
	expect(menu.NineSlice.SetAlpha).toHaveBeenLastCalledWith(0.8);
	expect(pool.release).toHaveBeenCalledWith("Frame", border);
});
