import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

export function applyIconOutline(
	pool: IFramePoolManager,
	frame: WowFrame,
): void {
	const artwork = pool.getDecoration(frame, "action-slot-artwork");
	artwork.SetAllPoints();
	artwork.SetAtlas("UI-HUD-ActionBar-IconFrame", false);
	// The mask includes transparent padding; a 48px icon needs a 64px mask.
	pool.setBackgroundMask(frame, "UI-HUD-ActionBar-IconFrame-Mask", 8);
}

// CharacterFrame.xml and ButtonFrameTemplateNoPortrait in Blizzard_SharedXML.
// Keep the atlas-sized corners intact while the edges stretch with the window.
const corners = [
	["TOPLEFT", "UI-Frame-Metal-CornerTopLeft", -8, 16],
	["TOPRIGHT", "UI-Frame-Metal-CornerTopRight", 4, 16],
	["BOTTOMLEFT", "UI-Frame-Metal-CornerBottomLeft", -8, -3],
	["BOTTOMRIGHT", "UI-Frame-Metal-CornerBottomRight", 4, -3],
] as const;
const edges = [
	[
		"_UI-Frame-Metal-EdgeTop",
		"TOPLEFT",
		0,
		"TOPRIGHT",
		"TOPRIGHT",
		1,
		"TOPLEFT",
	],
	[
		"_UI-Frame-Metal-EdgeBottom",
		"BOTTOMLEFT",
		2,
		"BOTTOMRIGHT",
		"BOTTOMRIGHT",
		3,
		"BOTTOMLEFT",
	],
	[
		"!UI-Frame-Metal-EdgeLeft",
		"TOPLEFT",
		0,
		"BOTTOMLEFT",
		"BOTTOMLEFT",
		2,
		"TOPLEFT",
	],
	[
		"!UI-Frame-Metal-EdgeRight",
		"TOPRIGHT",
		1,
		"BOTTOMRIGHT",
		"BOTTOMRIGHT",
		3,
		"TOPRIGHT",
	],
] as const;

export function applyWindowSkin(
	pool: IFramePoolManager,
	frame: WowFrame,
): void {
	const background = pool.getBackground(frame);
	background.ClearAllPoints();
	background.SetAtlas("character-panel-background", false);
	const parts: WowTexture[] = [];
	for (const [point, atlas, x, y] of corners) {
		const texture = pool.getDecoration(frame, `window-${point}`);
		texture.ClearAllPoints();
		texture.SetAtlas(atlas, true);
		texture.SetPoint(point, frame, point, x, y);
		parts.push(texture);
	}
	background.SetPoint("TOPLEFT", frame, "TOPLEFT", 2, -2);
	background.SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", -2, 2);
	for (const [
		atlas,
		point,
		first,
		relativePoint,
		end,
		last,
		relativeEnd,
	] of edges) {
		const startCorner = parts.at(first);
		const endCorner = parts.at(last);
		if (!startCorner || !endCorner) continue;
		const texture = pool.getDecoration(frame, `window-${point}-${end}`);
		texture.ClearAllPoints();
		texture.SetAtlas(atlas, true);
		texture.SetPoint(point, startCorner, relativePoint, 0, 0);
		texture.SetPoint(end, endCorner, relativeEnd, 0, 0);
	}
}

/** Retail Escape menu's BigRedThreeSliceButtonTemplate artwork. */
export function applyButtonSkin(
	pool: IFramePoolManager,
	frame: WowFrame,
	selected: boolean,
): void {
	const suffix = selected ? "-Pressed" : "";
	const native = frame as WowFrame & {
		GetHeight(): number;
	};
	const atlasClient = C_Texture as unknown as {
		GetAtlasInfo(this: void, atlas: string): { width: number; height: number };
	};
	const left = pool.getDecoration(frame, "button-left");
	const right = pool.getDecoration(frame, "button-right");
	for (const [texture, point, atlas] of [
		[left, "LEFT", "128-RedButton-Left"],
		[right, "RIGHT", "128-RedButton-Right"],
	] as const) {
		const info = atlasClient.GetAtlasInfo(atlas);
		texture.ClearAllPoints();
		texture.SetAtlas(`${atlas}${suffix}`, false);
		texture.SetWidth(native.GetHeight() * (info.width / info.height));
		texture.SetPoint(`TOP${point}`, frame, `TOP${point}`, 0, 0);
		texture.SetPoint(`BOTTOM${point}`, frame, `BOTTOM${point}`, 0, 0);
	}
	const middle = pool.getBackground(frame);
	middle.ClearAllPoints();
	middle.SetAtlas(`_128-RedButton-Center${suffix}`, false);
	middle.SetHorizTile(true);
	middle.SetPoint("TOPLEFT", left, "TOPRIGHT", 0, 0);
	middle.SetPoint("BOTTOMRIGHT", right, "BOTTOMLEFT", 0, 0);
}
