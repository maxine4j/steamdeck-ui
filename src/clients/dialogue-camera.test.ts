import { afterEach, expect, it, vi } from "vitest";
import { DialogueCamera } from "./dialogue-camera";

afterEach(() => vi.unstubAllGlobals());
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
