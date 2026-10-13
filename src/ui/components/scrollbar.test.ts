import { expect, it, vi } from "vitest";
import type { WowFrame, WowTexture } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("shows a thin proportional indicator and follows scroll, range and viewport changes", () => {
	let height = 200;
	let range = 600;
	let offset = 0;
	const scripts = new Map<string, (() => void) | undefined>();
	const textures: WowTexture[] = [];
	const native = {
		Hide: vi.fn(),
		Show: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		SetScript: (name: string, callback?: () => void) =>
			scripts.set(name, callback),
		EnableMouseWheel: vi.fn(),
		EnableMouse: vi.fn(),
		SetPropagateMouseClicks: vi.fn(),
		SetScrollChild: vi.fn(),
		GetHeight: () => height,
		GetVerticalScrollRange: () => range,
		GetVerticalScroll: () => offset,
		SetVerticalScroll: (value: number) => {
			offset = value;
			scripts.get("OnVerticalScroll")?.();
		},
		CreateTexture: () => {
			const texture = {
				ClearAllPoints: vi.fn(),
				SetAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetWidth: vi.fn(),
				SetHeight: vi.fn(),
				SetColorTexture: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetAtlas: vi.fn(),
			};
			textures.push(texture);
			return texture;
		},
	};
	const pool = new FramePoolManager({
		createFrame: () => native as unknown as WowFrame,
	});
	const scroll = new Frame("scroll", pool, "ScrollFrame");
	scroll.setScrollContent(new Frame("content", pool));
	const thumb = textures.at(-1);
	if (!thumb) throw new Error("Missing scroll indicator");
	expect(thumb.SetWidth).toHaveBeenLastCalledWith(3);
	expect(thumb.SetHeight).toHaveBeenLastCalledWith(48);
	scroll.scrollToEdge("down");
	expect(thumb.SetPoint).toHaveBeenLastCalledWith(
		"TOPRIGHT",
		native,
		"TOPRIGHT",
		-3,
		-148,
	);
	const resized = vi.fn();
	scroll.onSizeChanged(resized);
	height = 100;
	scripts.get("OnSizeChanged")?.();
	expect(resized).toHaveBeenCalledOnce();
	expect(thumb.SetHeight).toHaveBeenLastCalledWith(24);
	range = 0;
	scripts.get("OnScrollRangeChanged")?.();
	expect(thumb.SetColorTexture).toHaveBeenLastCalledWith(1, 1, 1, 0);
	expect(scripts.has("OnDragStart")).toBe(false);
	expect(scripts.has("OnClick")).toBe(false);
	scroll.destroy();
	expect(scripts.get("OnVerticalScroll")).toBeUndefined();
	expect(scripts.get("OnScrollRangeChanged")).toBeUndefined();
});
