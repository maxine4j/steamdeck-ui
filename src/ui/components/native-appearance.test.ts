import { expect, it, vi } from "vitest";
import { NativeAppearance } from "./native-appearance";
import type { LayoutFrame } from "./native-layout";

it("fits replacement artwork to the entire native host and restores its atlas, crop and anchors", () => {
	const parent = {} as LayoutFrame;
	const texture = {
		GetAtlas: () => "parchment",
		SetAtlas: vi.fn(),
		GetNumPoints: () => 1,
		GetPoint: () =>
			["TOP", parent, "TOP", 0, -4] as LuaMultiReturn<
				[string, LayoutFrame, string, number, number]
			>,
		GetSize: () => [304, 440] as LuaMultiReturn<[number, number]>,
		GetTexCoord: () => [0, 1, 0, 0.8] as LuaMultiReturn<number[]>,
		ClearAllPoints: vi.fn(),
		SetAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		SetTexCoord: vi.fn(),
		IsShown: () => true,
		Show: vi.fn(),
		Hide: vi.fn(),
	};
	const appearance = new NativeAppearance();
	appearance.background(texture, parent, "dark");
	expect(texture.SetAtlas).toHaveBeenLastCalledWith("dark");
	expect(texture.SetAllPoints).toHaveBeenLastCalledWith(parent);
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
	appearance.background(texture, parent, "dark");
	appearance.release();
	expect(texture.SetAtlas).toHaveBeenLastCalledWith("parchment");
	expect(texture.SetSize).toHaveBeenLastCalledWith(304, 440);
	expect(texture.SetPoint).toHaveBeenLastCalledWith(
		"TOP",
		parent,
		"TOP",
		0,
		-4,
	);
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 0.8);
});

it("makes native content readable on dark artwork and restores text colors without styling texture regions", () => {
	const text = {
		GetTextColor: () =>
			[0.2, 0.1, 0, 0.9] as LuaMultiReturn<[number, number, number, number]>,
		SetTextColor: vi.fn(),
	};
	const content = {
		GetRegions: () => [text, {}] as LuaMultiReturn<(typeof text | object)[]>,
	};
	const appearance = new NativeAppearance();
	appearance.lightText(content);
	expect(text.SetTextColor).toHaveBeenLastCalledWith(0.9, 0.9, 0.9, 0.9);
	appearance.lightText(content);
	appearance.release();
	expect(text.SetTextColor).toHaveBeenLastCalledWith(0.2, 0.1, 0, 0.9);
});
