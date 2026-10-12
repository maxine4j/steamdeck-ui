import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

// CharacterFrame.xml and ButtonFrameTemplateNoPortrait in Blizzard_SharedXML.
// Keep the atlas-sized corners intact while the edges stretch with the window.
const corners = [
	["TOPLEFT", "UI-Frame-Metal-CornerTopLeft"],
	["TOPRIGHT", "UI-Frame-Metal-CornerTopRight"],
	["BOTTOMLEFT", "UI-Frame-Metal-CornerBottomLeft"],
	["BOTTOMRIGHT", "UI-Frame-Metal-CornerBottomRight"],
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
	background.SetAllPoints();
	background.SetAtlas("character-panel-background", false);
	const parts: WowTexture[] = [];
	for (const [point, atlas] of corners) {
		const texture = pool.getDecoration(frame, `window-${point}`);
		texture.ClearAllPoints();
		texture.SetAtlas(atlas, true);
		texture.SetPoint(point, frame, point, 0, 0);
		parts.push(texture);
	}
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

/** The three slices and UVs from UIPanelButtonNoTooltipTemplate. */
export function applyButtonSkin(
	pool: IFramePoolManager,
	frame: WowFrame,
	selected: boolean,
): void {
	const file = `Interface\\Buttons\\UI-Panel-Button-${selected ? "Down" : "Up"}`;
	const left = pool.getDecoration(frame, "button-left");
	const right = pool.getDecoration(frame, "button-right");
	for (const [texture, point, u, v] of [
		[left, "LEFT", 0, 0.09375],
		[right, "RIGHT", 0.53125, 0.625],
	] as const) {
		texture.ClearAllPoints();
		texture.SetTexture(file);
		texture.SetTexCoord(u, v, 0, 0.6875);
		texture.SetWidth(12);
		texture.SetPoint(`TOP${point}`, frame, `TOP${point}`, 0, 0);
		texture.SetPoint(`BOTTOM${point}`, frame, `BOTTOM${point}`, 0, 0);
	}
	const middle = pool.getBackground(frame);
	middle.ClearAllPoints();
	middle.SetTexture(file);
	middle.SetTexCoord(0.09375, 0.53125, 0, 0.6875);
	middle.SetPoint("TOPLEFT", left, "TOPRIGHT", 0, 0);
	middle.SetPoint("BOTTOMRIGHT", right, "BOTTOMLEFT", 0, 0);
}
