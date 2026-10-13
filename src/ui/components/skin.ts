import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

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
	middle.SetPoint("TOPLEFT", left, "TOPRIGHT", 0, 0);
	middle.SetPoint("BOTTOMRIGHT", right, "BOTTOMLEFT", 0, 0);
}

type AtlasTexture = WowTexture & {
	SetVertexColor(red: number, green: number, blue: number): void;
};

/** Slice a single atlas into fixed corners/borders and a stretchable interior. */
export function applyAtlasNineSlice(
	pool: IFramePoolManager,
	frame: WowFrame,
	atlas: string,
	slice: number,
	tint: readonly [number, number, number] = [1, 1, 1],
): boolean {
	const atlasClient = C_Texture as unknown as {
		GetAtlasInfo(
			this: void,
			name: string,
		):
			| {
					width: number;
					height: number;
					leftTexCoord: number;
					rightTexCoord: number;
					topTexCoord: number;
					bottomTexCoord: number;
			  }
			| undefined;
	};
	const info = atlasClient.GetAtlasInfo(atlas);
	if (!info || info.width <= 0 || info.height <= 0) return false;
	const border = Math.max(0, Math.min(slice, info.width / 2, info.height / 2));
	const horizontal =
		((info.rightTexCoord - info.leftTexCoord) * border) / info.width;
	const vertical =
		((info.bottomTexCoord - info.topTexCoord) * border) / info.height;
	const u = [
		info.leftTexCoord,
		info.leftTexCoord + horizontal,
		info.rightTexCoord - horizontal,
		info.rightTexCoord,
	];
	const v = [
		info.topTexCoord,
		info.topTexCoord + vertical,
		info.bottomTexCoord - vertical,
		info.bottomTexCoord,
	];
	for (let row = 0; row < 3; row++) {
		for (let column = 0; column < 3; column++) {
			const texture = pool.getDecoration(
				frame,
				`button-slice-${row}-${column}`,
			) as AtlasTexture;
			texture.ClearAllPoints();
			texture.SetAtlas(atlas, false);
			texture.SetTexCoord(
				u.at(column) ?? 0,
				u.at(column + 1) ?? 1,
				v.at(row) ?? 0,
				v.at(row + 1) ?? 1,
			);
			texture.SetVertexColor(...tint);
			if (column !== 1) texture.SetWidth(border);
			if (row !== 1) texture.SetHeight(border);
			const start = `${row === 2 ? "BOTTOM" : "TOP"}${column === 2 ? "RIGHT" : "LEFT"}`;
			const end = `${row === 0 ? "TOP" : "BOTTOM"}${column === 0 ? "LEFT" : "RIGHT"}`;
			texture.SetPoint(
				start,
				frame,
				start,
				column === 1 ? border : 0,
				row === 1 ? -border : 0,
			);
			texture.SetPoint(
				end,
				frame,
				end,
				column === 1 ? -border : 0,
				row === 1 ? border : 0,
			);
		}
	}
	return true;
}

export function clearAtlasNineSlice(
	pool: IFramePoolManager,
	frame: WowFrame,
): void {
	for (let row = 0; row < 3; row++) {
		for (let column = 0; column < 3; column++) {
			const texture = pool.getDecoration(
				frame,
				`button-slice-${row}-${column}`,
			) as AtlasTexture;
			texture.SetVertexColor(1, 1, 1);
			texture.SetColorTexture(0, 0, 0, 0);
		}
	}
}
