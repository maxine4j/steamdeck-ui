import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { ItemTooltip } from "./item-tooltip";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const frames: ReturnType<typeof native>[] = [];
	function native() {
		let shown = false;
		return {
			Hide: vi.fn(() => {
				shown = false;
			}),
			Show: vi.fn(() => {
				shown = true;
			}),
			IsShown: () => shown,
			SetOwner: vi.fn(),
			SetHyperlink: vi.fn(),
			ClearLines: vi.fn(),
			SetScale: vi.fn(),
			SetParent: vi.fn(),
			SetFrameStrata: vi.fn(),
			SetPoint: vi.fn(),
			SetSize: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetScript: vi.fn(),
			EnableMouse: vi.fn(),
			GetWidth: () => 300,
			GetHeight: () => 400,
			CreateTexture: () => ({
				SetAllPoints: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetColorTexture: vi.fn(),
			}),
		};
	}
	const screen = { GetWidth: () => 1920, GetHeight: () => 1080 };
	vi.stubGlobal("UIParent", screen);
	const compare = vi.fn(() => frames.at(1)?.Show());
	vi.stubGlobal("GameTooltip_ShowCompareItem", compare);
	const factory = {
		createFrame: vi.fn(() => {
			const frame = native();
			frames.push(frame);
			return frame as unknown as WowFrame;
		}),
	};
	const pool = new FramePoolManager(factory);
	const tooltip = new ItemTooltip(pool);
	return { tooltip, frames, factory, screen, compare, pool };
}

it("renders full instance links with native equipped stat comparisons centered at the top", () => {
	const { tooltip, frames, screen, compare } = setup();
	tooltip.setItem("item:42:bonus");
	const main = frames.at(0);
	expect(main?.SetHyperlink).toHaveBeenCalledWith("item:42:bonus");
	expect(compare).toHaveBeenCalledWith(main);
	expect(main?.SetFrameStrata).toHaveBeenCalledWith("TOOLTIP");
	expect(main?.EnableMouse).toHaveBeenCalledWith(false);
	expect(main?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		screen,
		"TOP",
		-304,
		-32,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		screen,
		"TOP",
		4,
		-32,
	);
});

it("clears comparisons when changing items, hides on blur and reuses pooled tooltips", () => {
	const { tooltip, frames, factory, compare, pool } = setup();
	tooltip.setItem(42);
	compare.mockImplementation(() => {});
	tooltip.setItem(43);
	expect(frames.at(0)?.SetHyperlink).toHaveBeenLastCalledWith("item:43");
	expect(frames.at(1)?.IsShown()).toBe(false);
	tooltip.setItem(undefined);
	expect(frames.every((frame) => !frame.IsShown())).toBe(true);
	tooltip.setItem(44);
	expect(factory.createFrame).toHaveBeenCalledTimes(3);
	tooltip.destroy();
	const next = new ItemTooltip(pool);
	next.setItem(45);
	expect(factory.createFrame).toHaveBeenCalledTimes(3);
});
