import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

afterEach(() => vi.unstubAllGlobals());

it("registers Escape closing once and removes its handler and global alias before pooled reuse", () => {
	const globals: Record<string, unknown> = {};
	const specialFrames: string[] = [];
	vi.stubGlobal("_G", globals);
	vi.stubGlobal("UISpecialFrames", specialFrames);
	const scripts = new Map<string, (() => void) | undefined>();
	const native = {
		Hide: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		SetScript: (script: string, handler?: () => void) =>
			scripts.set(script, handler),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	} as unknown as WowFrame;
	const pool = new FramePoolManager({ createFrame: () => native });
	const frame = new Frame("escape-test", pool);
	const close = vi.fn();
	frame.onClose(close);
	frame.onClose(close);
	expect(specialFrames).toHaveLength(1);
	expect(globals[specialFrames.at(0) ?? ""]).toBe(native);
	scripts.get("OnHide")?.();
	expect(close).toHaveBeenCalledOnce();
	frame.destroy();
	expect(specialFrames).toEqual([]);
	expect(Object.values(globals).filter((value) => value !== undefined)).toEqual(
		[],
	);
	expect(scripts.get("OnHide")).toBeUndefined();
	expect(pool.acquire("Frame")).toBe(native);
});

it("configures secure spells through the global combat guard and leaves attributes unchanged in combat", () => {
	const combat = vi.fn(() => false);
	vi.stubGlobal("InCombatLockdown", combat);
	vi.stubGlobal("C_RestrictedActions", {});
	const native = {
		Hide: vi.fn(),
		RegisterForClicks: vi.fn(),
		SetAttribute: vi.fn(),
		CreateTexture: () => ({ SetAllPoints: vi.fn() }),
	} as unknown as WowFrame & { SetAttribute: ReturnType<typeof vi.fn> };
	const frame = new Frame(
		"spell",
		new FramePoolManager({ createFrame: () => native }),
		"SecureButton",
	);
	frame.setSpell(259740);
	expect(native.SetAttribute.mock.calls).toEqual([
		["type", "spell"],
		["spell", 259740],
	]);
	combat.mockReturnValue(true);
	frame.setSpell(150544);
	expect(native.SetAttribute).toHaveBeenCalledTimes(2);
	combat.mockReturnValue(false);
	frame.setSpell();
	expect(native.SetAttribute).toHaveBeenLastCalledWith("spell", undefined);
});

it("crops the baked icon rim and restores full texture coordinates for pooled reuse", () => {
	const texture = {
		SetAllPoints: vi.fn(),
		SetTexture: vi.fn(),
		SetColorTexture: vi.fn(),
		SetTexCoord: vi.fn(),
	};
	const native = {
		Hide: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		CreateTexture: () => texture,
	} as unknown as WowFrame;
	const pool = new FramePoolManager({ createFrame: () => native });
	const frame = new Frame("icon", pool);
	frame.setIcon(133633);
	expect(texture.SetTexture).toHaveBeenCalledWith(133633);
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0.07, 0.93, 0.07, 0.93);
	frame.destroy();
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
});

it.each(["left", "right", "fullscreen"] as const)(
	"raises the %s dock above ordinary UI and resets it for reuse",
	(position) => {
		const native = {
			Hide: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetSize: vi.fn(),
			SetPoint: vi.fn(),
			SetParent: vi.fn(),
			SetFrameStrata: vi.fn(),
			SetScript: vi.fn(),
			CreateTexture: () => ({
				SetAllPoints: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetColorTexture: vi.fn(),
			}),
		} as unknown as WowFrame;
		const pool = new FramePoolManager({ createFrame: () => native });
		const frame = new Frame("dock", pool);
		frame.dock(position, 500);
		expect(native.SetFrameStrata).toHaveBeenLastCalledWith("DIALOG");
		frame.destroy();
		expect(native.SetFrameStrata).toHaveBeenLastCalledWith("PARENT");
		expect(pool.acquire("Frame")).toBe(native);
	},
);
