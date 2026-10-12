import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { applyButtonSkin, applyWindowSkin } from "./skin";

function setup() {
	vi.stubGlobal("C_Texture", {
		GetAtlasInfo: () => ({ width: 32, height: 128 }),
	});
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
		GetHeight: () => 40,
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

it("replaces a sliced button with a full-frame atlas and clears its old caps", () => {
	const { pool, textures } = setup();
	const frame = new Frame("atlas-row", pool, "Button");
	frame.setButtonBackground();
	frame.setAtlasBackground("tile-art");
	expect(textures.at(0)?.SetAtlas).toHaveBeenLastCalledWith("tile-art", false);
	expect(textures.at(0)?.SetAllPoints).toHaveBeenCalled();
	for (const cap of textures.slice(1))
		expect(cap.SetColorTexture).toHaveBeenLastCalledWith(0, 0, 0, 0);
});

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
	for (const [index, point, x, y] of [
		[1, "TOPLEFT", -8, 16],
		[2, "TOPRIGHT", 4, 16],
		[3, "BOTTOMLEFT", -8, -3],
		[4, "BOTTOMRIGHT", 4, -3],
	] as const) {
		expect(textures.at(index)?.SetPoint).toHaveBeenLastCalledWith(
			point,
			native,
			point,
			x,
			y,
		);
	}
	applyWindowSkin(pool, native);
	expect(native.CreateTexture).toHaveBeenCalledTimes(9);
	pool.release("Frame", native);
	for (const texture of textures) {
		expect(texture.SetColorTexture).toHaveBeenLastCalledWith(0, 0, 0, 0);
		expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
	}
});

it("uses Escape menu button atlases with proportional caps and distinct selected artwork", () => {
	const { native, pool, textures } = setup();
	applyButtonSkin(pool, native, false);
	expect(textures.at(0)?.SetAtlas).toHaveBeenLastCalledWith(
		"128-RedButton-Left",
		false,
	);
	expect(textures.at(1)?.SetAtlas).toHaveBeenLastCalledWith(
		"128-RedButton-Right",
		false,
	);
	expect(textures.at(2)?.SetAtlas).toHaveBeenLastCalledWith(
		"_128-RedButton-Center",
		false,
	);
	expect(textures.at(0)?.SetWidth).toHaveBeenLastCalledWith(10);
	expect(textures.at(1)?.SetWidth).toHaveBeenLastCalledWith(10);
	applyButtonSkin(pool, native, true);
	expect(textures.at(0)?.SetAtlas).toHaveBeenLastCalledWith(
		"128-RedButton-Left-Pressed",
		false,
	);
	expect(textures.at(1)?.SetAtlas).toHaveBeenLastCalledWith(
		"128-RedButton-Right-Pressed",
		false,
	);
	expect(textures.at(2)?.SetAtlas).toHaveBeenLastCalledWith(
		"_128-RedButton-Center-Pressed",
		false,
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
	expect(textures.at(1)?.SetAtlas).toHaveBeenLastCalledWith(
		"128-RedButton-Left",
		false,
	);
});
