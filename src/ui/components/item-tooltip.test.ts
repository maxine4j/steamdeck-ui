import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
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
			RefreshData: vi.fn(),
			shouldRefreshData: false,
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
	const events = createTestEventBus();
	const tooltip = new ItemTooltip(pool, events);
	return { tooltip, frames, factory, screen, compare, pool, events };
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
	const { tooltip, frames, factory, compare, pool, events } = setup();
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
	const next = new ItemTooltip(pool, events);
	next.setItem(45);
	expect(factory.createFrame).toHaveBeenCalledTimes(3);
});

it("refreshes focused content after equipment and item data changes and unsubscribes on destroy", () => {
	const { tooltip, frames, compare, events } = setup();
	tooltip.setItem("item:42:bonus");
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(frames.at(0)?.SetHyperlink).toHaveBeenCalledTimes(3);
	expect(compare).toHaveBeenCalledTimes(3);
	tooltip.setItem(undefined);
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	expect(compare).toHaveBeenCalledTimes(3);
	tooltip.destroy();
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(compare).toHaveBeenCalledTimes(3);
});

it("fits two equipped comparisons on a narrow display and reanchors asynchronously refreshed data", () => {
	const { tooltip, frames, screen, compare } = setup();
	screen.GetWidth = () => 1280;
	screen.GetHeight = () => 800;
	compare.mockImplementation(() => {
		frames.at(1)?.Show();
		frames.at(2)?.Show();
	});
	tooltip.setItem(42);
	const scale = 480 / 916;
	for (const frame of frames)
		expect(frame.SetScale).toHaveBeenLastCalledWith(scale);
	const main = frames.at(0);
	if (!main) throw new Error("Missing main tooltip");
	main.shouldRefreshData = true;
	const update = main.SetScript.mock.calls
		.find((call) => call.at(0) === "OnUpdate")
		?.at(1) as ((frame: unknown, elapsed: number) => void) | undefined;
	expect(update).toBeDefined();
	update?.(main, 0.25);
	expect(main.RefreshData).toHaveBeenCalledOnce();
	expect(main.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		screen,
		"TOP",
		-458,
		-32 / scale,
	);
	main.shouldRefreshData = false;
	const anchors = main.SetPoint.mock.calls.length;
	update?.(main, 0.25);
	expect(main.SetPoint).toHaveBeenCalledTimes(anchors);
});
