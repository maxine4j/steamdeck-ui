import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("scales a preview frame and restores its native scale on pooled release", () => {
	const native = {
		SetScale: vi.fn(),
		Hide: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		SetSize: vi.fn(),
		ClearAllPoints: vi.fn(),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetColorTexture: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
		}),
	} as unknown as WowFrame & { SetScale: ReturnType<typeof vi.fn> };
	const frame = new Frame(
		"preview",
		new FramePoolManager({ createFrame: () => native }),
	);
	frame.setScale(0.5);
	expect(native.SetScale).toHaveBeenLastCalledWith(0.5);
	frame.destroy();
	expect(native.SetScale).toHaveBeenLastCalledWith(1);
});
