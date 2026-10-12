import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "./events/test-event-bus";
import { startSteamDeckUI } from "./start";
import type { WowFrame, WowTexture } from "./types";
import type { FrameType } from "./ui/frame-pool-manager";

afterEach(() => vi.unstubAllGlobals());

it("docks full-height side containers and refreshes a grouped, pooled one-bag grid", () => {
	vi.stubGlobal("_G", {});
	vi.stubGlobal("UISpecialFrames", []);
	const frames: WowFrame[] = [];
	const textures: WowTexture[] = [];
	const labels: string[][] = [];
	const factory = {
		createFrame: (type: FrameType) => {
			const texts: string[] = [];
			labels.push(texts);
			const texture = {
				ClearAllPoints: vi.fn(),
				SetAllPoints: vi.fn(),
				SetColorTexture: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetPoint: vi.fn(),
				SetHeight: vi.fn(),
				SetWidth: vi.fn(),
			};
			const frame = {
				CreateFontString: () => ({
					SetText: vi.fn((text: string) => {
						texts.push(text);
					}),
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
				EnableMouse: vi.fn(),
				SetScrollChild: vi.fn(),
				GetVerticalScroll: () => 0,
				GetVerticalScrollRange: () => 0,
				SetVerticalScroll: vi.fn(),
				Show: vi.fn(),
				Hide: vi.fn(),
				SetParent: vi.fn(),
				SetFrameStrata: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetSize: vi.fn(),
				GetHeight: () => (type === "GameTooltip" ? 440 : 600),
				GetWidth: () => (type === "GameTooltip" ? 320 : 1280),
				SetOwner: vi.fn(),
				SetHyperlink: vi.fn(),
				ClearLines: vi.fn(),
				SetScale: vi.fn(),
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
	const events = createTestEventBus();
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
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("MountJournal", { IsShown: () => false, HookScript: vi.fn() });
	vi.stubGlobal("CollectionsJournal", {
		IsShown: () => false,
		HookScript: vi.fn(),
	});
	vi.stubGlobal("ToggleCharacter", vi.fn());
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
		destroyItem: vi.fn(),
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
				hyperlink: "item:42:bonus:123",
			},
		]),
	};
	const reputation = {
		getReputations: vi.fn(() => [
			{
				index: 1,
				id: 42,
				name: "Faction",
				description: "Description",
				header: false,
				collapsed: false,
				watched: false,
				standing: "Friendly",
				progress: "10 / 100",
			},
		]),
		activate: vi.fn(),
	};
	const titles = {
		getTitles: vi.fn(() => [{ id: -1, name: "None", selected: true }]),
		select: vi.fn(),
	};
	const controller = {
		disableBuiltIn: vi.fn(),
		initialize: vi.fn(),
		setActive: vi.fn(),
		shutdown: vi.fn(),
	};
	const app = startSteamDeckUI(
		factory,
		events,
		inventory,
		character,
		reputation,
		titles,
		{
			getMounts: () => [],
			summon: vi.fn(),
			pickupRandom: vi.fn(),
			getCount: () => ({ collected: 0, total: 0 }),
			search: vi.fn(),
			getFilters: () => [],
			toggleFilter: vi.fn(),
			toggleFavourite: vi.fn(),
			getEquipment: () => ({ icon: 134400, label: "Empty" }),
			applyEquipment: vi.fn(),
			getUtilitySpells: () => ({ favourite: 150544, flight: 1 }),
		},
		{
			canModify: () => false,
			syncBuiltInVisibility: vi.fn(),
			disableBuiltIn: vi.fn(),
			restore: vi.fn(),
			read: vi.fn(),
			bind: vi.fn(),
			getSlotDriver: vi.fn(),
		},
		controller,
	);
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
	expect(controller.disableBuiltIn).toHaveBeenCalledOnce();
	expect(controller.initialize).toHaveBeenCalledOnce();
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
	expect(app.navigation.focusedId).toBe("bags-group-toggle");
	app.navigation.moveDown();
	expect(app.navigation.focusedId).toContain("bags-item-42");
	events.emit("BAG_UPDATE_DELAYED");
	expect(app.navigation.focusedId).toContain("bags-item-42");
	expect(inventory.getItems).toHaveBeenCalledTimes(3);
	expect(frames).toHaveLength(count);
	events.emit("NAV_INTERACT");
	expect(inventory.useItem).not.toHaveBeenCalled();
	events.emit("NAV_ALTERNATE");
	expect(inventory.useItem).toHaveBeenCalledOnce();
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("item-actions-use");
	const detailTooltip = frames.find(
		(frame) =>
			"SetHyperlink" in frame &&
			vi.mocked(
				(frame as WowFrame & { SetHyperlink: ReturnType<typeof vi.fn> })
					.SetHyperlink,
			).mock.calls.length > 0,
	);
	expect(detailTooltip).toBeDefined();
	expect(
		(detailTooltip as WowFrame & { SetHyperlink: ReturnType<typeof vi.fn> })
			.SetHyperlink,
	).toHaveBeenLastCalledWith("item:42:bonus:123");
	const detailWindow = frames.find((frame) =>
		vi
			.mocked(frame.SetSize)
			.mock.calls.some(([width, height]) => width === 660 && height === 480),
	);
	expect(detailWindow).toBeDefined();
	events.emit("NAV_ALTERNATE");
	expect(inventory.useItem).toHaveBeenCalledOnce();
	const overlay = frames.find((frame) =>
		vi
			.mocked(frame.SetFrameStrata)
			.mock.calls.some(([strata]) => strata === "FULLSCREEN_DIALOG"),
	);
	expect(overlay?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		undefined,
		"TOPLEFT",
		0,
		0,
	);
	expect(detailWindow?.SetPoint).toHaveBeenCalledWith(
		"CENTER",
		overlay,
		"CENTER",
		0,
		0,
	);
	const tooltipHides = detailTooltip
		? vi.mocked(detailTooltip.Hide).mock.calls.length
		: 0;
	events.emit("NAV_CANCEL");
	expect(detailTooltip?.Hide).toHaveBeenCalledTimes(tooltipHides + 1);
	expect(app.navigation.focusedId).toContain("bags-item-42");
	const modalCount = frames.length;
	events.emit("NAV_CONTEXT");
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(app.navigation.focusedId).toBe("item-actions-cancel");
	expect(inventory.destroyItem).not.toHaveBeenCalled();
	events.emit("NAV_DOWN");
	events.emit("NAV_INTERACT");
	expect(inventory.destroyItem).toHaveBeenCalledOnce();
	expect(app.navigation.focusedId).toContain("bags-item-42");
	events.emit("NAV_CONTEXT");
	events.emit("NAV_INTERACT");
	events.emit("NAV_CONTEXT");
	events.emit("COMBAT_STARTED");
	expect(inventory.useItem).toHaveBeenCalledTimes(2);
	expect(app.navigation.focusedId).toContain("bags-item-42");
	expect(frames).toHaveLength(modalCount);
	const rightFrame = frames.at(1);
	if (!rightFrame) throw new Error("Missing right container");
	const rightHides = vi.mocked(rightFrame.Hide).mock.calls.length;
	character.isOpen.mockReturnValue(true);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(character.getEquipment).toHaveBeenCalledOnce();
	expect(frames.at(0)?.Show).toHaveBeenCalled();
	expect(frames.at(1)?.Hide).toHaveBeenCalledTimes(rightHides);
	const clickTab = (icon: number) => {
		const index = textures.findIndex((texture) =>
			vi
				.mocked(texture.SetTexture)
				.mock.calls.some((call) => call.at(0) === icon),
		);
		const native = frames.at(index);
		if (!native) throw new Error("Missing tab frame");
		const handler = vi
			.mocked(native.SetScript)
			.mock.calls.find((call) => call.at(0) === "OnClick")
			?.at(1) as ((frame: unknown, button: string) => void) | undefined;
		if (!handler) throw new Error("Missing tab button");
		handler(native, "LeftButton");
	};
	clickTab(133784);
	expect(reputation.getReputations).toHaveBeenCalledOnce();
	const clickRow = (text: string) => {
		const native = frames.at(labels.findIndex((texts) => texts.includes(text)));
		if (!native) throw new Error("Missing list row");
		const handler = vi
			.mocked(native.SetScript)
			.mock.calls.find((call) => call.at(0) === "OnClick")
			?.at(1) as ((frame: unknown, button: string) => void) | undefined;
		if (!handler) throw new Error("Missing list row action");
		return () => handler(native, "LeftButton");
	};
	const clickFaction = clickRow("Faction");
	clickFaction();
	expect(reputation.activate).toHaveBeenCalledWith(
		reputation.getReputations().at(0),
	);
	clickTab(133759);
	expect(titles.getTitles).toHaveBeenCalledOnce();
	clickFaction();
	expect(reputation.activate).toHaveBeenCalledOnce();
	clickRow("None")();
	expect(titles.select).toHaveBeenCalledExactlyOnceWith(-1);
	const withTabs = frames.length;
	clickTab(133784);
	clickTab(133759);
	clickTab(135906);
	expect(frames).toHaveLength(withTabs);
	character.isOpen.mockReturnValue(false);
	events.emit("CHARACTER_VISIBILITY_CHANGED");
	expect(frames.at(0)?.Hide).toHaveBeenCalled();
	expect(frames.at(1)?.Hide).toHaveBeenCalledTimes(rightHides);
	const withPaperDoll = frames.length;
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("item-actions-use");
	app.ui.closePanel("right");
	expect(app.navigation.focusedId).toBeUndefined();
	app.ui.openPanel("bags", "right");
	expect(frames).toHaveLength(withPaperDoll);
	events.emit("NAV_CONTEXT");
	expect(app.navigation.focusedId).toBe("item-actions-use");
	inventory.getItems.mockReturnValue([]);
	events.emit("BAG_UPDATE_DELAYED");
	expect(bagIcon?.Hide).toHaveBeenCalled();
	expect(app.navigation.focusedId).not.toContain("bags-item-");
	app.stop();
	expect(controller.shutdown).toHaveBeenCalledOnce();
	events.emit("BAG_UPDATE_DELAYED");
	expect(inventory.getItems).toHaveBeenCalledTimes(4);
	for (const frame of builtIns)
		expect(frame.SetParent).toHaveBeenLastCalledWith(nativeParent);
});
