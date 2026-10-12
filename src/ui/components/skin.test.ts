import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { applyButtonSkin, applyWindowSkin } from "./skin";

function setup() {
	const textures: ReturnType<typeof texture>[] = [];
	function texture() {
		return {
			SetAtlas: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetColorTexture: vi.fn(),
			SetAllPoints: vi.fn(),
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
			const result = texture();
			textures.push(result);
			return result;
		}),
	} as unknown as WowFrame;
	const pool = new FramePoolManager({ createFrame: () => native });
	pool.acquire("Frame");
	return { native, pool, textures };
}

it("uses character window artwork and reuses its corners and edges", () => {
	const { native, pool, textures } = setup();
	applyWindowSkin(pool, native);
	expect(textures.at(0)?.SetAtlas).toHaveBeenCalledWith(
		"character-panel-background",
		false,
	);
	expect(textures.at(1)?.SetAtlas).toHaveBeenCalledWith(
		"UI-Frame-Metal-CornerTopLeft",
		true,
	);
	applyWindowSkin(pool, native);
	expect(native.CreateTexture).toHaveBeenCalledTimes(9);
	pool.release("Frame", native);
	for (const texture of textures) {
		expect(texture.SetColorTexture).toHaveBeenLastCalledWith(0, 0, 0, 0);
		expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
	}
});

it("uses sliced Blizzard button textures and keeps selected buttons visibly distinct", () => {
	const { native, pool, textures } = setup();
	applyButtonSkin(pool, native, false);
	expect(textures.at(2)?.SetTexCoord).toHaveBeenLastCalledWith(
		0.09375,
		0.53125,
		0,
		0.6875,
	);
	applyButtonSkin(pool, native, true);
	expect(textures.at(0)?.SetTexture).toHaveBeenLastCalledWith(
		"Interface\\Buttons\\UI-Panel-Button-Down",
	);
	expect(native.CreateTexture).toHaveBeenCalledTimes(3);
});

it("clears button caps when a reused list row becomes a heading", () => {
	const { pool, textures } = setup();
	const frame = new Frame("row", pool, "Button");
	frame.setButtonBackground();
	frame.setColor(0, 0, 0, 0);
	for (const cap of textures.slice(1))
		expect(cap.SetColorTexture).toHaveBeenLastCalledWith(0, 0, 0, 0);
	expect(textures.at(0)?.SetAllPoints).toHaveBeenCalled();
	frame.setButtonBackground();
	expect(textures.at(1)?.SetTexture).toHaveBeenLastCalledWith(
		"Interface\\Buttons\\UI-Panel-Button-Up",
	);
});
