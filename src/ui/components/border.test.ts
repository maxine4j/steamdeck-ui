import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { setBorder } from "./border";

it("draws four inset edges and clears and reuses them with the pooled frame", () => {
	const textures: ReturnType<typeof makeTexture>[] = [];
	function makeTexture() {
		return {
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetColorTexture: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
		};
	}
	const native = {
		Hide: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		CreateTexture: vi.fn(() => {
			const texture = makeTexture();
			textures.push(texture);
			return texture;
		}),
	} as unknown as WowFrame;
	const pool = new FramePoolManager({ createFrame: () => native });
	const frame = pool.acquire("Frame");
	setBorder(pool, frame, [0.4, 0.5, 0.6, 1]);
	expect(textures).toHaveLength(4);
	for (const texture of textures) {
		expect(texture.SetColorTexture).toHaveBeenLastCalledWith(0.4, 0.5, 0.6, 1);
		expect(texture.SetPoint).toHaveBeenCalledTimes(2);
	}
	expect(textures.at(0)?.SetHeight).toHaveBeenCalledWith(2);
	expect(textures.at(0)?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		frame,
		"TOPLEFT",
		0,
		0,
	);
	expect(textures.at(1)?.SetHeight).toHaveBeenCalledWith(2);
	expect(textures.at(2)?.SetWidth).toHaveBeenCalledWith(2);
	expect(textures.at(3)?.SetWidth).toHaveBeenCalledWith(2);
	pool.release("Frame", frame);
	for (const texture of textures)
		expect(texture.SetColorTexture).toHaveBeenLastCalledWith(0, 0, 0, 0);
	setBorder(pool, pool.acquire("Frame"), [0.2, 0.3, 0.4, 1]);
	expect(textures).toHaveLength(4);
});
