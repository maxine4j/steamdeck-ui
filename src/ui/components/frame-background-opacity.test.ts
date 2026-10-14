import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("fades only background artwork and restores opacity when artwork changes or the frame is released", () => {
	const texture = {
		SetAlpha: vi.fn(),
		SetAtlas: vi.fn(),
		SetTexture: vi.fn(),
		SetTexCoord: vi.fn(),
		SetAllPoints: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetColorTexture: vi.fn(),
	};
	const native = {
		Hide: vi.fn(),
		SetAlpha: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		SetSize: vi.fn(),
		ClearAllPoints: vi.fn(),
		CreateTexture: () => texture,
	} as unknown as WowFrame & { SetAlpha: ReturnType<typeof vi.fn> };
	const frame = new Frame(
		"backplate",
		new FramePoolManager({ createFrame: () => native }),
	);
	frame.setAtlasBackground("spellbook-item-backplate");
	frame.setBackgroundOpacity(0.12);
	expect(texture.SetAlpha).toHaveBeenLastCalledWith(0.12);
	expect(native.SetAlpha).not.toHaveBeenCalled();
	frame.setAtlasBackground("other-artwork");
	expect(texture.SetAlpha).toHaveBeenLastCalledWith(1);
	frame.setBackgroundOpacity(0.12);
	frame.destroy();
	expect(texture.SetAlpha).toHaveBeenLastCalledWith(1);
});
