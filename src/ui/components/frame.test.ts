import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

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
