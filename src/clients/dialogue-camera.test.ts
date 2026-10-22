import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DialogueCamera } from "./dialogue-camera";

const settings = new Map<string, string>();
beforeEach(() => {
	settings.clear();
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) => settings.get(name) ?? "0",
		SetCVar: vi.fn((name: string, value: string | number) =>
			settings.set(name, `${value}`),
		),
	});
});
afterEach(() => vi.unstubAllGlobals());
it("preserves camera preferences without enabling experimental features during repeated conversations", () => {
	settings.set("test_cameraOverShoulder", "0.7");
	settings.set("CameraKeepCharacterCentered", "1");
	settings.set("test_cameraTargetFocusInteractStrengthPitch", "0.25");
	const original = new Map(settings);
	vi.stubGlobal("GetCameraZoom", () => 3);
	vi.stubGlobal("UnitExists", () => true);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("CameraZoomIn", vi.fn());
	const c = new DialogueCamera();
	c.begin(true);
	c.begin(true);
	c.end();
	c.begin(true);
	c.end();
	expect(C_CVar.SetCVar).not.toHaveBeenCalled();
	expect(settings).toEqual(original);
	expect(CameraZoomIn).not.toHaveBeenCalled();
});
it("zooms for NPC conversations once and restores the original distance", () => {
	let zoom = 12;
	vi.stubGlobal("GetCameraZoom", () => zoom);
	vi.stubGlobal("UnitExists", () => true);
	vi.stubGlobal("InCombatLockdown", () => false);
	const inward = vi.fn((amount: number) => {
			zoom -= amount;
		}),
		outward = vi.fn((amount: number) => {
			zoom += amount;
		});
	vi.stubGlobal("CameraZoomIn", inward);
	vi.stubGlobal("CameraZoomOut", outward);
	const c = new DialogueCamera();
	c.begin(true);
	c.begin(true);
	expect(inward).toHaveBeenCalledExactlyOnceWith(8);
	c.end();
	c.end();
	expect(zoom).toBe(12);
	expect(outward).toHaveBeenCalledOnce();
});
it("leaves item and remote offers, combat and first-person cameras alone", () => {
	vi.stubGlobal("GetCameraZoom", () => 0);
	vi.stubGlobal("UnitExists", () => true);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("CameraZoomIn", vi.fn());
	const c = new DialogueCamera();
	c.begin(false);
	c.begin(true);
	expect(CameraZoomIn).not.toHaveBeenCalled();
});
