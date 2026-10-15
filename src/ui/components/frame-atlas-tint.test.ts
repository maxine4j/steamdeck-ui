import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("neutralizes colored atlas artwork before tinting and restores color on reuse", () => {
	const texture = {
		SetAtlas: vi.fn(),
		SetTexture: vi.fn(),
		SetTexCoord: vi.fn(),
		SetVertexColor: vi.fn(),
		SetDesaturated: vi.fn(),
		SetAllPoints: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetColorTexture: vi.fn(),
	};
	const native = {
		Hide: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		SetSize: vi.fn(),
		ClearAllPoints: vi.fn(),
		CreateTexture: () => texture,
	} as unknown as WowFrame;
	const frame = new Frame(
		"tinted-atlas",
		new FramePoolManager({ createFrame: () => native }),
	);
	frame.setAtlasBackground("green-fill", [0.15, 0.45, 0.95], undefined, true);
	expect(texture.SetAtlas).toHaveBeenLastCalledWith("green-fill", false);
	expect(texture.SetDesaturated).toHaveBeenLastCalledWith(true);
	expect(texture.SetVertexColor).toHaveBeenLastCalledWith(0.15, 0.45, 0.95);
	expect(texture.SetDesaturated.mock.invocationCallOrder.at(-1)).toBeLessThan(
		texture.SetVertexColor.mock.invocationCallOrder.at(-1) ?? 0,
	);
	frame.setAtlasBackground("tile-art");
	expect(texture.SetDesaturated).toHaveBeenLastCalledWith(false);
	expect(texture.SetVertexColor).toHaveBeenLastCalledWith(1, 1, 1);
	frame.setAtlasBackground("green-fill", [0.8, 0.15, 0.15], undefined, true);
	frame.setIcon(133633);
	expect(texture.SetDesaturated).toHaveBeenLastCalledWith(false);
	frame.setAtlasBackground("green-fill", undefined, undefined, true);
	frame.destroy();
	expect(texture.SetDesaturated).toHaveBeenLastCalledWith(false);
});
