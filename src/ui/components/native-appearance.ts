import type { LayoutFrame } from "./native-layout";
import {
	NativeVisibility,
	type NativeVisibleRegion,
} from "./native-visibility";

export interface NativeBackground extends NativeVisibleRegion {
	GetAtlas(): string;
	SetAtlas(atlas: string): void;
	GetNumPoints(): number;
	GetPoint(
		index: number,
	): LuaMultiReturn<[string, LayoutFrame, string, number, number]>;
	GetSize(): LuaMultiReturn<[number, number]>;
	GetTexCoord(): LuaMultiReturn<number[]>;
	ClearAllPoints(): void;
	SetAllPoints(parent: LayoutFrame): void;
	SetPoint(
		point: string,
		relative: LayoutFrame,
		relativePoint: string,
		x: number,
		y: number,
	): void;
	SetSize(width: number, height: number): void;
	SetTexCoord(...coordinates: number[]): void;
}
interface NativeTextRegion {
	GetTextColor?(): LuaMultiReturn<[number, number, number, number]>;
	SetTextColor?(red: number, green: number, blue: number, alpha: number): void;
}
export interface NativeTextContent {
	GetRegions(): LuaMultiReturn<NativeTextRegion[]>;
}

/** Reversible styling of existing native artwork and text. */
export class NativeAppearance {
	private readonly visibility = new NativeVisibility();
	private readonly backgrounds = new Map<
		NativeBackground,
		{
			atlas: string;
			points: [string, LayoutFrame, string, number, number][];
			size: [number, number];
			coordinates: number[];
		}
	>();
	private readonly colors = new Map<
		NativeTextRegion,
		[number, number, number, number]
	>();
	background(
		texture: NativeBackground,
		parent: LayoutFrame,
		atlas: string,
	): void {
		if (!this.backgrounds.has(texture)) {
			const points: [string, LayoutFrame, string, number, number][] = [];
			for (let index = 1; index <= texture.GetNumPoints(); index++) {
				const [point, relative, relativePoint, x, y] = texture.GetPoint(index);
				points.push([point, relative, relativePoint, x, y]);
			}
			const [width, height] = texture.GetSize();
			this.backgrounds.set(texture, {
				atlas: texture.GetAtlas(),
				points,
				size: [width, height],
				coordinates: [...texture.GetTexCoord()],
			});
		}
		texture.SetAtlas(atlas);
		texture.SetTexCoord(0, 1, 0, 1);
		texture.ClearAllPoints();
		texture.SetAllPoints(parent);
	}
	lightText(content: NativeTextContent): void {
		for (const region of [...content.GetRegions()]) {
			if (!region.GetTextColor || !region.SetTextColor) continue;
			const [red, green, blue, alpha] = region.GetTextColor();
			if (!this.colors.has(region))
				this.colors.set(region, [red, green, blue, alpha]);
			region.SetTextColor(0.9, 0.9, 0.9, alpha);
		}
	}
	hide(regions: readonly NativeVisibleRegion[]): void {
		this.visibility.hide(regions);
	}
	release(): void {
		this.visibility.restore();
		for (const [texture, original] of this.backgrounds) {
			texture.SetAtlas(original.atlas);
			texture.SetTexCoord(...original.coordinates);
			texture.ClearAllPoints();
			texture.SetSize(...original.size);
			for (const point of original.points) texture.SetPoint(...point);
		}
		this.backgrounds.clear();
		for (const [region, color] of this.colors) region.SetTextColor?.(...color);
		this.colors.clear();
	}
}
