import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";
import { ItemTooltip } from "./item-tooltip";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const frames: ReturnType<typeof native>[] = [];
	function native() {
		let shown = false;
		let text = "";
		return {
			Hide: vi.fn(() => {
				shown = false;
			}),
			Show: vi.fn(() => {
				shown = true;
			}),
			IsShown: () => shown,
			SetOwner: vi.fn(() => {
				text = "";
			}),
			SetHyperlink: vi.fn(),
			SetText: vi.fn((value: string) => {
				text = value;
			}),
			getText: () => text,
			SetToyByItemID: vi.fn(),
			SetMountBySpellID: vi.fn(),
			SetCompanionPet: vi.fn(),
			AddLine: vi.fn(),
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
				SetAtlas: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetWidth: vi.fn(),
				SetHeight: vi.fn(),
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

it("anchors plain text focus tooltips outside their supplied panel", () => {
	const { tooltip, frames, pool } = setup();
	const anchor = new Frame("achievement-panel", pool);
	anchor.show();
	const nativeAnchor = frames.at(0);
	tooltip.setItem({ text: "Achievement", anchor });
	expect(frames.at(1)?.getText()).toBe("Achievement");
	expect(frames.at(1)?.SetOwner).toHaveBeenLastCalledWith(
		nativeAnchor,
		"ANCHOR_NONE",
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		nativeAnchor,
		"TOPRIGHT",
		0,
		0,
	);
});

it("renders mount collection details without equipment comparisons", () => {
	const { tooltip, frames, compare } = setup();
	tooltip.setItem({ mountSpell: 123 });
	expect(frames.at(0)?.SetMountBySpellID).toHaveBeenCalledExactlyOnceWith(123);
	expect(frames.at(0)?.SetHyperlink).not.toHaveBeenCalled();
	expect(compare).not.toHaveBeenCalled();
});

it("centers spell details at the top without equipped-item comparisons", () => {
	const { tooltip, frames, screen, compare } = setup();
	tooltip.setItem({ spell: 42 });
	expect(frames.at(0)?.SetHyperlink).toHaveBeenCalledWith("spell:42");
	expect(frames.at(0)?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		screen,
		"TOP",
		-150,
		-32,
	);
	expect(compare).not.toHaveBeenCalled();
});

it("centers pet collection tooltips at the top without learning-item links or comparisons", () => {
	const { tooltip, frames, screen, compare } = setup();
	tooltip.setItem({
		pet: { id: "Pet-1", name: "Cat", collected: true, source: "Vendor" },
	});
	expect(frames.at(0)?.SetCompanionPet).toHaveBeenCalledWith("Pet-1");
	expect(frames.at(0)?.SetHyperlink).not.toHaveBeenCalled();
	expect(compare).not.toHaveBeenCalled();
	expect(frames.at(0)?.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		screen,
		"TOP",
		-150,
		-32,
	);
});

it("renders and refreshes toy details without item links or equipment comparisons", () => {
	const { tooltip, frames, compare, events } = setup();
	tooltip.setItem({ toy: 42 });
	expect(frames.at(0)?.SetToyByItemID).toHaveBeenCalledExactlyOnceWith(42);
	expect(frames.at(0)?.SetHyperlink).not.toHaveBeenCalled();
	expect(compare).not.toHaveBeenCalled();
	events.emit("ITEM_DATA_LOAD_RESULT");
	expect(frames.at(0)?.SetToyByItemID).toHaveBeenCalledTimes(2);
	tooltip.setItem(43);
	expect(compare).toHaveBeenCalledOnce();
	tooltip.setItem({ toy: 44 });
	expect(frames.at(1)?.IsShown()).toBe(false);
	expect(frames.at(0)?.SetToyByItemID).toHaveBeenLastCalledWith(44);
});

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

it("keeps equipped item details comparison-free through event and asynchronous refreshes", () => {
	const { tooltip, frames, compare, events } = setup();
	tooltip.setItem(41);
	compare.mockClear();
	tooltip.setItem({ item: "item:42:bonus" });
	const main = frames.at(0);
	if (!main) throw new Error("Missing main tooltip");
	expect(main.SetHyperlink).toHaveBeenLastCalledWith("item:42:bonus");
	expect(frames.at(1)?.IsShown()).toBe(false);
	events.emit("PLAYER_EQUIPMENT_CHANGED");
	events.emit("ITEM_DATA_LOAD_RESULT");
	main.shouldRefreshData = true;
	const update = main.SetScript.mock.lastCall?.at(1) as
		| ((frame: unknown, elapsed: number) => void)
		| undefined;
	update?.(main, 0.25);
	expect(main.RefreshData).toHaveBeenCalledOnce();
	expect(compare).not.toHaveBeenCalled();
	tooltip.setItem(43);
	expect(compare).toHaveBeenCalledOnce();
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

it("preserves full-size equipped comparisons on a narrow display and reanchors asynchronously refreshed data", () => {
	const { tooltip, frames, screen, compare } = setup();
	screen.GetWidth = () => 1280;
	screen.GetHeight = () => 800;
	compare.mockImplementation(() => {
		frames.at(1)?.Show();
		frames.at(2)?.Show();
	});
	tooltip.setItem(42);
	const scale = 1;
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

it.each(["left", "right"] as const)(
	"anchors full-size comparisons outside the active %s panel's top corner",
	(side) => {
		const { tooltip, frames, pool, events, compare } = setup();
		const anchor = new Frame("active-panel", pool);
		anchor.show();
		const nativeAnchor = frames.at(0);
		compare.mockImplementation(() => frames.at(2)?.Show());
		tooltip.setAnchor(anchor, side);
		tooltip.setItem(42);
		const main = frames.at(1);
		const comparison = frames.at(2);
		expect(main?.SetPoint).toHaveBeenLastCalledWith(
			side === "left" ? "TOPLEFT" : "TOPRIGHT",
			nativeAnchor,
			side === "left" ? "TOPRIGHT" : "TOPLEFT",
			side === "left" ? 8 : -8,
			0,
		);
		expect(comparison?.SetPoint).toHaveBeenLastCalledWith(
			side === "left" ? "TOPLEFT" : "TOPRIGHT",
			nativeAnchor,
			side === "left" ? "TOPRIGHT" : "TOPLEFT",
			side === "left" ? 316 : -316,
			0,
		);
		for (const frame of frames.slice(1))
			expect(frame.SetScale).toHaveBeenLastCalledWith(1);
		events.emit("ITEM_DATA_LOAD_RESULT");
		expect(main?.SetPoint).toHaveBeenLastCalledWith(
			side === "left" ? "TOPLEFT" : "TOPRIGHT",
			nativeAnchor,
			side === "left" ? "TOPRIGHT" : "TOPLEFT",
			side === "left" ? 8 : -8,
			0,
		);
	},
);
