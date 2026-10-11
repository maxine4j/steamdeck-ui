import { afterEach, expect, it, vi } from "vitest";
import { EventBus } from "./events/event-bus";
import { startSteamDeckUI } from "./start";
import type { WowFrame, WowTexture } from "./types";

afterEach(() => vi.unstubAllGlobals());

it("docks full-height side containers and refreshes a grouped, pooled one-bag grid", () => {
	const frames: WowFrame[] = [];
	const textures: WowTexture[] = [];
	const factory = {
		createFrame: () => {
			const texture = {
				SetAllPoints: vi.fn(),
				SetColorTexture: vi.fn(),
				SetTexture: vi.fn(),
			};
			const frame = {
				CreateFontString: () => ({
					SetText: vi.fn(),
					SetPoint: vi.fn(),
					ClearAllPoints: vi.fn(),
					SetFont: vi.fn(),
					SetJustifyH: vi.fn(),
					SetWidth: vi.fn(),
				}),
				SetScript: vi.fn(),
				RegisterForClicks: vi.fn(),
				RegisterForDrag: vi.fn(),
				EnableMouseWheel: vi.fn(),
				SetScrollChild: vi.fn(),
				GetVerticalScroll: () => 0,
				GetVerticalScrollRange: () => 0,
				SetVerticalScroll: vi.fn(),
				Show: vi.fn(),
				Hide: vi.fn(),
				SetParent: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetSize: vi.fn(),
				SetUnit: vi.fn(),
				SetPortraitZoom: vi.fn(),
				SetCamDistanceScale: vi.fn(),
				SetFacing: vi.fn(),
				ClearModel: vi.fn(),
				CreateTexture: () => texture,
			};
			frames.push(frame);
			textures.push(texture);
			return frame;
		},
	};
	const events = new EventBus();
	const nativeParent = {};
	const builtIns = Array.from({ length: 7 }, () => ({
		GetParent: () => nativeParent,
		SetParent: vi.fn(),
	}));
	[
		"ContainerFrameCombinedBags",
		"ContainerFrame1",
		"ContainerFrame2",
		"ContainerFrame3",
		"ContainerFrame4",
		"ContainerFrame5",
		"ContainerFrame6",
	].forEach((name, index) => {
		vi.stubGlobal(name, builtIns.at(index));
	});
	vi.stubGlobal("hooksecurefunc", vi.fn());
	vi.stubGlobal("CharacterFrame", {
		GetParent: () => nativeParent,
		SetParent: vi.fn(),
		IsShown: () => false,
		activeSubframe: "PaperDollFrame",
	});
	const character = {
		open: vi.fn(),
		toggle: vi.fn(),
		isOpen: vi.fn(() => false),
		getEquipment: vi.fn(() => []),
		getStats: vi.fn(() => []),
		pickup: vi.fn(),
		use: vi.fn(),
		close: vi.fn(),
	};
	const inventory = {
		useItem: vi.fn(),
		pickupItem: vi.fn(),
		getMoney: vi.fn(() => 12345),
		isOpen: vi.fn(() => false),
		getItems: vi.fn(() => [
			{
				bagId: 0,
				slotId: 2,
				itemId: 42,
				iconFileId: 123,
				count: 1,
				quality: 3,
				category: "Equipment" as const,
				stackable: false,
			},
		]),
	};
	const app = startSteamDeckUI(factory, events, inventory, character);
	expect(frames).toHaveLength(2);
	expect(frames.at(0)?.SetSize).toHaveBeenCalledWith(500, 0);
	expect(frames.at(0)?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		undefined,
		"TOPLEFT",
		0,
		0,
	);
	expect(frames.at(0)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMLEFT",
		undefined,
		"BOTTOMLEFT",
		0,
		0,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenCalledWith(
		"TOPRIGHT",
		undefined,
		"TOPRIGHT",
		0,
		0,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMRIGHT",
		undefined,
		"BOTTOMRIGHT",
		0,
		0,
	);
	events.emit("PLAYER_LOGIN");
	expect(inventory.getItems).toHaveBeenCalledOnce();
	expect(frames).toHaveLength(3);
	for (const frame of builtIns)
		expect(frame.SetParent).toHaveBeenCalledWith(frames.at(2));
	inventory.isOpen.mockReturnValue(true);
	events.emit("BAG_VISIBILITY_CHANGED");
	expect(textures.at(-1)?.SetTexture).toHaveBeenCalledWith(123);
	expect(frames.at(-1)?.SetPoint).toHaveBeenCalledWith(
		"CENTER",
		frames.at(-2),
		"CENTER",
		0,
		0,
	);
	const count = frames.length;
	const bagIcon = frames.at(-1);
	events.emit("BAG_UPDATE_DELAYED");
	expect(inventory.getItems).toHaveBeenCalledTimes(3);
	expect(frames).toHaveLength(count);
	const rightFrame = frames.at(1);
	if (!rightFrame) throw new Error("Missing right container");
	const rightHides = vi.mocked(rightFrame.Hide).mock.calls.length;
	character.isOpen.mockReturnValue(true);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(character.getEquipment).toHaveBeenCalledOnce();
	expect(frames.at(0)?.Show).toHaveBeenCalled();
	expect(frames.at(1)?.Hide).toHaveBeenCalledTimes(rightHides);
	character.isOpen.mockReturnValue(false);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(frames.at(0)?.Hide).toHaveBeenCalled();
	expect(frames.at(1)?.Hide).toHaveBeenCalledTimes(rightHides);
	const withPaperDoll = frames.length;
	app.ui.closePanel("right");
	app.ui.openPanel("bags", "right");
	expect(frames).toHaveLength(withPaperDoll);
	inventory.getItems.mockReturnValue([]);
	events.emit("BAG_UPDATE_DELAYED");
	expect(bagIcon?.Hide).toHaveBeenCalled();
	app.stop();
	events.emit("BAG_UPDATE_DELAYED");
	expect(inventory.getItems).toHaveBeenCalledTimes(4);
	for (const frame of builtIns)
		expect(frame.SetParent).toHaveBeenLastCalledWith(nativeParent);
});
