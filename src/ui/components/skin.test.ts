import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { applyButtonSkin, applyWindowSkin } from "./skin";

it("outlines focused controls without covering their contents and reuses the outline", () => {
	const { pool, textures, native } = setup();
	const frame = new Frame("search", pool, "EditBox");
	frame.setFocused(true);
	expect(textures).toHaveLength(5);
	for (const edge of textures.slice(1)) {
		expect(edge.SetColorTexture).toHaveBeenLastCalledWith(1, 0.82, 0, 1);
		expect(edge.SetAllPoints).not.toHaveBeenCalled();
	}
	frame.setFocused(false);
	for (const edge of textures.slice(1))
		expect(edge.SetColorTexture).toHaveBeenLastCalledWith(1, 0.82, 0, 0);
	frame.setFocused(true);
	expect(native.CreateTexture).toHaveBeenCalledTimes(5);
});

function setup() {
	vi.stubGlobal("C_Texture", {
		GetAtlasInfo: () => ({ width: 32, height: 128 }),
	});
	const textures: ReturnType<typeof texture>[] = [];
	function texture() {
		return {
			SetAtlas: vi.fn(),
			SetTexture: vi.fn(),
			AddMaskTexture: vi.fn(),
			RemoveMaskTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetHorizTile: vi.fn(),
			SetColorTexture: vi.fn(),
			SetAllPoints: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
		};
	}
	const mask = texture();
	const native = {
		CreateMaskTexture: vi.fn(() => mask),
		SetPoint: vi.fn(),
		SetScript: vi.fn(),
		RegisterForClicks: vi.fn(),
		RegisterForDrag: vi.fn(),
		Show: vi.fn(),
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
	return { native, pool, textures, mask };
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
	expect(textures.at(0)?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		native,
		"TOPLEFT",
		2,
		-2,
	);
	expect(textures.at(0)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMRIGHT",
		native,
		"BOTTOMRIGHT",
		-2,
		2,
	);
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

it("tiles the button center across its width and clears tiling when replacing its skin", () => {
	const { pool, textures } = setup();
	const frame = new Frame("titles-back", pool, "Button");
	frame.layout(96, 26);
	frame.setButtonBackground();
	const center = textures.at(0);
	expect(center?.SetHorizTile).toHaveBeenLastCalledWith(true);
	frame.setColor(0, 0, 0, 0);
	expect(center?.SetHorizTile).toHaveBeenLastCalledWith(false);
	frame.setButtonBackground();
	frame.destroy();
	expect(center?.SetHorizTile).toHaveBeenLastCalledWith(false);
});

it("adds reusable rounded action icon artwork without replacing the icon", () => {
	const { pool, textures, native } = setup();
	const frame = new Frame("target", pool);
	frame.setIcon("target-art", false);
	frame.setIconOutline();
	frame.setIconOutline();
	expect(textures.at(0)?.SetTexture).toHaveBeenLastCalledWith("target-art");
	expect(textures.at(1)?.SetAtlas).toHaveBeenLastCalledWith(
		"UI-HUD-ActionBar-IconFrame",
		false,
	);
	expect(textures.at(1)?.SetAllPoints).toHaveBeenCalled();
	expect(native.CreateTexture).toHaveBeenCalledTimes(2);
});

it("clips action icons to the rounded mask and detaches it before pooled reuse", () => {
	const { pool, native, textures, mask } = setup();
	const frame = new Frame("target", pool);
	frame.setIcon("target-art", false);
	frame.setIconOutline();
	frame.setIconOutline();
	expect(mask.SetAtlas).toHaveBeenLastCalledWith(
		"UI-HUD-ActionBar-IconFrame-Mask",
		false,
	);
	expect(mask.SetAllPoints).toHaveBeenCalled();
	expect(mask.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		textures.at(0),
		"TOPLEFT",
		-8,
		8,
	);
	expect(mask.SetPoint).toHaveBeenCalledWith(
		"BOTTOMRIGHT",
		textures.at(0),
		"BOTTOMRIGHT",
		8,
		-8,
	);
	expect(textures.at(0)?.AddMaskTexture).toHaveBeenCalledExactlyOnceWith(mask);
	expect(native.CreateMaskTexture).toHaveBeenCalledOnce();
	frame.destroy();
	expect(textures.at(0)?.RemoveMaskTexture).toHaveBeenCalledExactlyOnceWith(
		mask,
	);
	const reused = new Frame("another-icon", pool);
	reused.setIcon("next-art");
	expect(textures.at(0)?.AddMaskTexture).toHaveBeenCalledTimes(1);
	reused.setIconOutline();
	expect(textures.at(0)?.AddMaskTexture).toHaveBeenCalledTimes(2);
	expect(native.CreateMaskTexture).toHaveBeenCalledOnce();
});

it.each([
	[20, 30, 32 * (20 / 30), 32],
	[32, 32, 32, 32],
	[60, 30, 32, 16],
])(
	"fits a %ix%i atlas icon without distorting its proportions",
	(width, height, expectedWidth, expectedHeight) => {
		const { pool, textures } = setup();
		vi.stubGlobal("C_Texture", { GetAtlasInfo: () => ({ width, height }) });
		const frame = new Frame("tab", pool);
		frame.setAtlasIcon("micro-menu-art", 32, 32, 2);
		expect(textures.at(0)?.SetAtlas).toHaveBeenLastCalledWith(
			"micro-menu-art",
			false,
		);
		expect(textures.at(0)?.SetWidth.mock.lastCall?.at(0)).toBeCloseTo(
			expectedWidth,
		);
		expect(textures.at(0)?.SetHeight.mock.lastCall?.at(0)).toBeCloseTo(
			expectedHeight,
		);
		expect(textures.at(0)?.SetPoint).toHaveBeenLastCalledWith(
			"CENTER",
			expect.anything(),
			"CENTER",
			2,
			0,
		);
	},
);

it("renders the full live portrait as a square without the narrow micro-menu mask", () => {
	const { pool, textures } = setup();
	vi.stubGlobal("C_Texture", {
		GetAtlasInfo: () => ({ width: 35, height: 65 }),
	});
	const portrait = vi.fn();
	vi.stubGlobal("SetPortraitTexture", portrait);
	const frame = new Frame("equipment-tab", pool);
	frame.setPortraitIcon("player", 32, 32, -2);
	expect(portrait).toHaveBeenCalledExactlyOnceWith(textures.at(0), "player");
	expect(textures.at(0)?.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
	expect(textures.at(0)?.SetHeight).toHaveBeenLastCalledWith(32);
	expect(textures.at(0)?.SetWidth).toHaveBeenLastCalledWith(32);
	expect(textures.at(0)?.AddMaskTexture).not.toHaveBeenCalled();
});
