import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { Frame } from "../ui/components/frame";
import { MapClient } from "./map-client";

afterEach(() => vi.unstubAllGlobals());
function setup() {
	const events = createTestEventBus();
	const hooks = new Map<string, (...args: number[]) => void>();
	const scripts = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(
			target: string | unknown,
			method: string | ((...args: number[]) => void),
			callback?: (...args: number[]) => void,
		) => {
			if (typeof target === "string")
				hooks.set(target, method as (...args: number[]) => void);
			else hooks.set(method as string, callback ?? (() => {}));
		},
	);
	const frame = {
		dataProviders: [] as { Label?: object; GetOffsetY?: () => number }[],
		IsShown: vi.fn(() => true),
		HookScript: (name: string, callback: () => void) =>
			scripts.set(name, callback),
		OnFrameSizeChanged: vi.fn(),
		SetMapID: vi.fn(),
		GetMapID: vi.fn(() => 101),
		SetFocusedQuestID: vi.fn(),
		GetNormalizedCursorPosition: vi.fn(() => [0.9, 0.9]),
		IsCanvasMouseFocus: vi.fn(() => false),
		IsCanvasMouseFocusOrPinFocus: vi.fn(() => false),
		ExecuteOnAllPins: vi.fn(),
		EnumeratePinsByTemplate: vi.fn(() => []),
		HandleUserActionToggleSelf: vi.fn(),
		TitleCanvasSpacerFrame: {},
		ScrollContainer: {},
		NavBar: {},
		BorderFrame: {},
		BlackoutFrame: {},
		SidePanelToggle: {},
	};
	vi.stubGlobal(
		"secureexecuterange",
		(
			providers: typeof frame.dataProviders,
			callback: (provider: (typeof frame.dataProviders)[number]) => void,
		) => {
			for (const provider of providers) callback(provider);
		},
	);
	const quests = {
		ContentsAnchor: {},
		QuestsFrame: {
			ScrollFrame: {
				ScrollBar: {},
				SearchBox: { Clear: vi.fn() },
				SettingsDropdown: {},
			},
		},
		DetailsFrame: {
			Bg: {},
			SealMaterialBG: {},
			ScrollFrame: { ScrollBar: {}, Contents: {} },
		},
		QuestsTab: {},
		EventsTab: {},
		MapLegendTab: {},
		EventsFrame: {},
		MapLegend: {},
		QuestSessionManagement: {},
	};
	vi.stubGlobal("WorldMapFrame", frame);
	vi.stubGlobal("MAP_AND_QUEST_LOG", "Map & Quest Log");
	vi.stubGlobal("C_Map", {
		CanSetUserWaypointOnMap: vi.fn(() => false),
		SetUserWaypoint: vi.fn(() => true),
		GetMapArtLayers: vi.fn(() => [
			{ layerWidth: 1000, layerHeight: 666.6666666666666 },
		]),
	});
	vi.stubGlobal("UiMapPoint", {
		CreateFromCoordinates: vi.fn((uiMapID: number, x: number, y: number) => ({
			uiMapID,
			x,
			y,
		})),
	});
	vi.stubGlobal("QuestMapFrame", quests);
	vi.stubGlobal("HideUIPanel", vi.fn());
	vi.stubGlobal("GetQuestUiMapID", () => 101);
	vi.stubGlobal("QuestMapFrame_ShowQuestDetails", vi.fn());
	vi.stubGlobal("QuestMapFrame_ReturnFromQuestDetails", vi.fn());
	vi.stubGlobal("QuestMapQuestOptions_TrackQuest", vi.fn());
	vi.stubGlobal("QuestMapQuestOptions_AbandonQuest", vi.fn());
	vi.stubGlobal("QuestMapQuestOptions_ShareQuest", vi.fn());
	vi.stubGlobal("EventRegistry", { TriggerEvent: vi.fn() });
	vi.stubGlobal("C_SuperTrack", {
		GetSuperTrackedQuestID: () => 1,
		SetSuperTrackedQuestID: vi.fn(),
	});
	const layout = {
		bind: vi.fn(),
		release: vi.fn(),
		scroll: vi.fn(),
		navigation: vi.fn((_frame, _scroll, navId, onInteract) => ({
			navId,
			onInteract,
			onFocus: vi.fn(),
			onBlur: vi.fn(),
		})),
	};
	const cursor = {
		show: vi.fn(),
		hide: vi.fn(),
		move: vi.fn(),
		position: vi.fn(() => [420, 300] as const),
		contains: vi.fn(() => false),
		release: vi.fn(),
		trackMouseOver: vi.fn(),
		hover: vi.fn(),
	};
	const indicator = { bind: vi.fn(), release: vi.fn() };
	const appearance = {
		background: vi.fn(),
		lightText: vi.fn(),
		hide: vi.fn(),
		release: vi.fn(),
	};
	Object.assign(frame.ScrollContainer, {
		NormalizeUIPosition: vi.fn(() => [0.25, 0.75]),
		ShouldNavigateOnClick: () => false,
	});
	vi.stubGlobal("QuestLogQuests_Update", vi.fn());
	return {
		events,
		hooks,
		scripts,
		frame,
		quests,
		layout,
		cursor,
		indicator,
		appearance,
		client: new MapClient(
			events,
			layout,
			layout,
			cursor,
			indicator,
			appearance,
		),
	};
}
it("fits dark quest details artwork, hides the parchment overlay and makes description text readable", () => {
	const { client, hooks, quests, appearance, layout } = setup();
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	hooks.get("QuestMapFrame_ShowQuestDetails")?.(7);
	expect(appearance.background).toHaveBeenLastCalledWith(
		quests.DetailsFrame.Bg,
		quests.DetailsFrame,
		"QuestDetailsBackgrounds-Accessibility_Dark",
	);
	expect(appearance.hide).toHaveBeenCalledWith([
		quests.DetailsFrame.SealMaterialBG,
	]);
	expect(appearance.lightText).toHaveBeenCalledWith(
		quests.DetailsFrame.ScrollFrame.Contents,
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests,
		expect.objectContaining({ insets: [8, 20, 8, 40] }),
	);
	client.unmount();
	expect(appearance.release).toHaveBeenCalled();
});
it("sizes the combined panel to map art, breadcrumbs and title bar and uses Blizzard's localized title", () => {
	const { client } = setup();
	expect(client.presentation({ width: 1200, height: 720 })).toEqual({
		title: "Map & Quest Log",
		height: 880 / 1.5 + 52,
	});
	expect(client.presentation({ width: 1200, height: 500 })).toEqual({
		title: "Map & Quest Log",
		height: 500,
	});
});

it("insets and centers the map inside the fitted panel so its metal border remains visible", () => {
	const { client, frame, layout } = setup();
	client.disable();
	const size = {
		width: 1200,
		height: client.presentation({ width: 1200, height: 720 }).height,
	};
	client.mount({ getSize: () => size } as Frame, {} as Frame);
	const root = layout.bind.mock.calls
		.find((call) => call.at(0) === frame)
		?.at(1);
	const viewport = layout.bind.mock.calls
		.find((call) => call.at(0) === frame.ScrollContainer)
		?.at(1);
	expect(root).toMatchObject({ insets: [12, 28, 332, 8] });
	expect(viewport).toMatchObject({ size: [856, 856 / 1.5] });
	expect(client.presentation({ width: 1200, height: 720 }).height).toBe(
		size.height,
	);
});

it("uses the minimal indicator for native quests and restores Blizzard's scrollbar on close", () => {
	const { client, quests, indicator, layout } = setup();
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame,
		expect.objectContaining({ insets: [0, 0, 0, 0] }),
	);
	expect(indicator.bind).toHaveBeenCalledWith(quests.QuestsFrame.ScrollFrame);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame.ScrollFrame.ScrollBar,
		{ visible: false },
	);
	client.unmount();
	expect(indicator.release).toHaveBeenCalledOnce();
	expect(layout.release).toHaveBeenCalled();
});

it("removes the unused native search header without leaving a hidden quest filter", () => {
	const { client, quests, layout, hooks } = setup();
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	const scroll = quests.QuestsFrame.ScrollFrame;
	const rule = (target: object) =>
		layout.bind.mock.calls.find((call) => call.at(0) === target)?.at(1);
	expect(rule(scroll)).toMatchObject({ insets: [0, 0, 0, 0] });
	expect(rule(scroll.SearchBox)).toEqual({ visible: false });
	expect(rule(scroll.SettingsDropdown)).toEqual({ visible: false });
	hooks.get("QuestMapFrame_ShowQuestDetails")?.(7);
	expect(scroll.SearchBox.Clear).toHaveBeenCalledOnce();
});

it("invalidates panel sizing after a map change but stops emitting after unmount", () => {
	const { client, hooks, events } = setup();
	const refresh = vi.fn();
	events.subscribe("QUEST_LOG_UPDATE", refresh);
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	hooks.get("OnMapChanged")?.();
	expect(refresh).toHaveBeenCalledOnce();
	client.unmount();
	hooks.get("OnMapChanged")?.();
	expect(refresh).toHaveBeenCalledOnce();
});

it("shows and moves the map cursor only while mounted and releases it on close", () => {
	const { client, cursor, frame, hooks } = setup();
	client.setCursorActive(true);
	expect(cursor.show).not.toHaveBeenCalled();
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	expect(cursor.show).toHaveBeenCalledWith(
		frame.ScrollContainer,
		expect.any(Function),
	);
	client.moveCursor("up", true);
	expect(cursor.move).toHaveBeenCalledWith("up", true);
	hooks.get("OnMapChanged")?.();
	expect(cursor.show).toHaveBeenCalledTimes(2);
	client.setCursorActive(false);
	expect(cursor.hide).toHaveBeenCalled();
	client.moveCursor("left", true);
	expect(cursor.move).toHaveBeenCalledOnce();
	client.unmount();
	expect(cursor.release).toHaveBeenCalledOnce();
});

it("hovers icons with motion enabled even when mouse clicks are disabled", () => {
	const { client, frame, cursor } = setup();
	vi.mocked(C_Map.CanSetUserWaypointOnMap).mockReturnValue(true);
	const icon = {
		IsShown: () => true,
		IsMouseEnabled: () => false,
		IsMouseMotionEnabled: () => true,
		IsMouseClickEnabled: () => false,
		GetAlpha: () => 1,
		GetFrameLevel: () => 5,
		OnClick: vi.fn(),
	};
	frame.ExecuteOnAllPins.mockImplementation((callback) => callback(icon));
	cursor.contains.mockReturnValue(true);
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	expect(cursor.hover).toHaveBeenLastCalledWith(icon);
	client.clickMap("LeftButton");
	expect(icon.OnClick).not.toHaveBeenCalled();
	expect(C_Map.SetUserWaypoint).not.toHaveBeenCalled();
});

it("uses virtual map positions for party dot tooltips and restores the native unit query", () => {
	const { client, frame, cursor } = setup();
	const original = vi.fn(() => ["physical-party"]);
	const units = {
		IsShown: () => true,
		IsMouseMotionEnabled: () => false,
		IsMouseClickEnabled: () => false,
		GetAlpha: () => 1,
		GetFrameLevel: () => 5,
		GetMouseOverUnits: original,
		GetMemberCountAndUnitTokenPrefix: () => [2, "party"],
		IsMouseOverUnitExcluded: () => false,
		dataProvider: { GetUnitPinSizesTable: () => ({ party: 12, raid: 8 }) },
	};
	frame.ExecuteOnAllPins.mockImplementation((callback) => callback(units));
	Object.assign(frame.ScrollContainer, {
		GetCanvasScale: () => 1,
		DenormalizeHorizontalSize: () => 800,
		DenormalizeVerticalSize: () => 400,
	});
	const position = vi.fn((_id: number, unit: string) => ({
		GetXY: () => (unit === "party1" ? [0.25, 0.75] : [0.8, 0.8]),
	}));
	Object.assign(C_Map, { GetPlayerMapPosition: position });
	vi.stubGlobal("UnitInSubgroup", () => true);
	vi.stubGlobal("UnitExists", () => true);
	vi.stubGlobal("unpack", (values: string[]) => values);
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	expect(units.GetMouseOverUnits()).toEqual(["party1"]);
	expect(units.GetMouseOverUnits()).toEqual(["party1"]);
	expect(position).toHaveBeenCalledTimes(2);
	const tick = cursor.show.mock.lastCall?.at(1) as (() => void) | undefined;
	tick?.();
	units.GetMouseOverUnits();
	expect(position).toHaveBeenCalledTimes(4);
	client.setCursorActive(false);
	expect(units.GetMouseOverUnits).toBe(original);
});

it("keeps the native area name above the fullscreen map artwork", () => {
	const { client, frame, layout } = setup();
	const label = {};
	frame.dataProviders.push({ Label: label, GetOffsetY: () => -10 });
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	expect(layout.bind).toHaveBeenCalledWith(
		label,
		expect.objectContaining({
			strata: "DIALOG",
			parent: frame.ScrollContainer,
			levelOffset: 101,
			anchors: [["TOP", "TOP", 0, -10]],
		}),
	);
});

it("left clicks pins, quests and zones before waypoints using virtual coordinates; right click navigates out", () => {
	const { client, cursor, frame } = setup();
	const pin = { questID: 7, IsShown: () => true, OnClick: vi.fn() };
	const blob = {
		IsShown: () => true,
		UpdateMouseOverTooltip: vi.fn(() => [0, 0]),
	};
	Object.assign(frame, {
		EnumeratePinsByTemplate: (template: string) =>
			template === "QuestPinTemplate"
				? [pin]
				: template === "QuestBlobPinTemplate"
					? [blob]
					: [],
		NavigateToParentMap: vi.fn(),
	});
	Object.assign(pin, {
		IsMouseMotionEnabled: () => true,
		IsMouseClickEnabled: () => true,
		GetAlpha: () => 1,
		GetFrameLevel: () => 5,
	});
	frame.ExecuteOnAllPins.mockImplementation((callback) => callback(pin));
	const normalize = vi.fn(() => [0.25, 0.75]);
	Object.assign(frame.ScrollContainer, {
		NormalizeUIPosition: normalize,
		ShouldNavigateOnClick: () => true,
		ShouldNavigateIgnoreZoneMapPositionData: () => false,
		ShouldZoomInOnClick: () => false,
		ZoomOut: vi.fn(),
	});
	const zone = vi.fn<() => { mapID: number } | undefined>(() => ({
		mapID: 202,
	}));
	Object.assign(C_Map, { GetMapInfoAtPosition: zone });
	vi.mocked(C_Map.CanSetUserWaypointOnMap).mockReturnValue(true);
	client.clickMap("LeftButton");
	expect(zone).not.toHaveBeenCalled();
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	cursor.contains.mockReturnValue(true);
	client.clickMap("LeftButton");
	expect(pin.OnClick).toHaveBeenCalledWith("LeftButton");
	expect(C_Map.SetUserWaypoint).not.toHaveBeenCalled();
	expect(zone).not.toHaveBeenCalled();
	cursor.contains.mockReturnValue(false);
	blob.UpdateMouseOverTooltip.mockReturnValue([7, 1]);
	client.clickMap("LeftButton");
	expect(frame.SetFocusedQuestID).toHaveBeenCalledWith(7);
	expect(C_Map.SetUserWaypoint).not.toHaveBeenCalled();
	expect(zone).not.toHaveBeenCalled();
	blob.UpdateMouseOverTooltip.mockReturnValue([0, 0]);
	client.clickMap("LeftButton");
	expect(normalize).toHaveBeenCalledWith(420, 300);
	expect(zone).toHaveBeenCalledWith(101, 0.25, 0.75, false);
	expect(frame.SetMapID).toHaveBeenCalledWith(202);
	expect(C_Map.SetUserWaypoint).not.toHaveBeenCalled();
	zone.mockReturnValue(undefined);
	frame.SetMapID.mockClear();
	client.clickMap("LeftButton");
	expect(C_Map.SetUserWaypoint).toHaveBeenCalledWith({
		uiMapID: 101,
		x: 0.25,
		y: 0.75,
	});
	expect(frame.SetMapID).not.toHaveBeenCalled();
	client.clickMap("RightButton");
	expect(frame.NavigateToParentMap).toHaveBeenCalledOnce();
});

it("places a waypoint on empty map art without requiring zone navigation, and skips unsupported maps", () => {
	const { client } = setup();
	vi.mocked(C_Map.CanSetUserWaypointOnMap).mockReturnValue(true);
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	client.clickMap("LeftButton");
	expect(C_Map.SetUserWaypoint).toHaveBeenCalledWith({
		uiMapID: 101,
		x: 0.25,
		y: 0.75,
	});
	vi.mocked(C_Map.SetUserWaypoint).mockClear();
	vi.mocked(C_Map.CanSetUserWaypointOnMap).mockReturnValue(false);
	client.clickMap("LeftButton");
	expect(C_Map.SetUserWaypoint).not.toHaveBeenCalled();
});

it("clicks world map quest variants and non-quest icons using the topmost enabled pin", () => {
	const { client, cursor, frame } = setup();
	vi.mocked(C_Map.CanSetUserWaypointOnMap).mockReturnValue(true);
	const pin = (template: string, level: number) => ({
		pinTemplate: template,
		IsShown: () => true,
		IsMouseMotionEnabled: () => true,
		IsMouseClickEnabled: () => true,
		GetAlpha: () => 1,
		GetFrameLevel: () => level,
		OnClick: vi.fn(),
		OnMouseDown: vi.fn(),
		OnMouseUp: vi.fn(),
	});
	const quest = pin("WorldMap_WorldQuestPinTemplate", 4),
		poi = pin("AreaPOIPinTemplate", 5),
		hidden = { ...pin("hidden", 100), IsShown: () => false },
		disabled = {
			...pin("disabled", 101),
			IsMouseClickEnabled: () => false,
			IsMouseMotionEnabled: () => false,
		};
	frame.ExecuteOnAllPins.mockImplementation((callback) => {
		for (const target of [quest, poi, hidden, disabled]) callback(target);
	});
	cursor.contains.mockReturnValue(true);
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	client.clickMap("LeftButton");
	expect(poi.OnClick).toHaveBeenCalledWith("LeftButton");
	expect(poi.OnMouseDown).toHaveBeenCalledWith("LeftButton");
	expect(poi.OnMouseUp).toHaveBeenCalledWith("LeftButton", true);
	expect(quest.OnClick).not.toHaveBeenCalled();
	poi.IsMouseClickEnabled = () => false;
	client.clickMap("LeftButton");
	expect(quest.OnClick).toHaveBeenCalledWith("LeftButton");
	expect(C_Map.SetUserWaypoint).not.toHaveBeenCalled();
});

it("supplies virtual coordinates to native hover providers and restores physical mouse queries on blur", () => {
	const { client, cursor, frame } = setup();
	const originalPosition = frame.GetNormalizedCursorPosition,
		originalFocus = frame.IsCanvasMouseFocus;
	const highlight = {
		pinTemplate: "MapHighlightPinTemplate",
		IsShown: () => true,
		IsMouseMotionEnabled: () => false,
		IsMouseClickEnabled: () => false,
		IsMouseOver: vi.fn(),
		GetAlpha: () => 1,
		GetFrameLevel: () => 0,
	};
	const icon = {
		pinTemplate: "AreaPOIPinTemplate",
		IsShown: () => true,
		IsMouseMotionEnabled: () => true,
		IsMouseClickEnabled: () => true,
		IsMouseOver: vi.fn(),
		GetAlpha: () => 1,
		GetFrameLevel: () => 5,
		OnMouseEnter: vi.fn(),
	};
	frame.ExecuteOnAllPins.mockImplementation((callback) => {
		callback(highlight);
		callback(icon);
	});
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.setCursorActive(true);
	expect(frame.GetNormalizedCursorPosition()).toEqual([0.25, 0.75]);
	expect(frame.IsCanvasMouseFocus()).toBe(true);
	expect(cursor.trackMouseOver).toHaveBeenCalledWith(
		frame.ScrollContainer,
		highlight,
	);
	cursor.contains.mockReturnValue(true);
	const tick = cursor.show.mock.lastCall?.at(1) as (() => void) | undefined;
	tick?.();
	expect(cursor.hover).toHaveBeenLastCalledWith(icon);
	expect(frame.IsCanvasMouseFocus()).toBe(false);
	client.setCursorActive(false);
	expect(frame.GetNormalizedCursorPosition).toBe(originalPosition);
	expect(frame.IsCanvasMouseFocus).toBe(originalFocus);
	expect(cursor.hide).toHaveBeenCalled();
});
it("makes M close and reopen the combined pane without native flyout transitions, and restores the native handler", () => {
	const { client, frame, scripts, events } = setup();
	const nativeToggle = frame.HandleUserActionToggleSelf;
	const visibility: boolean[] = [];
	events.subscribe("MAP_VISIBILITY_CHANGED", () =>
		visibility.push(client.isOpen()),
	);
	vi.mocked(HideUIPanel).mockImplementation(() => {
		frame.IsShown.mockReturnValue(false);
		scripts.get("OnHide")?.();
	});
	vi.stubGlobal(
		"ShowUIPanel",
		vi.fn(() => {
			frame.IsShown.mockReturnValue(true);
			scripts.get("OnShow")?.();
		}),
	);
	client.disable();
	client.disable();
	frame.HandleUserActionToggleSelf();
	expect(client.isOpen()).toBe(false);
	frame.HandleUserActionToggleSelf();
	expect(client.isOpen()).toBe(true);
	frame.HandleUserActionToggleSelf();
	expect(client.isOpen()).toBe(false);
	expect(HideUIPanel).toHaveBeenCalledTimes(2);
	expect(ShowUIPanel).toHaveBeenCalledOnce();
	expect(visibility).toEqual([false, true, false]);
	expect(nativeToggle).not.toHaveBeenCalled();
	client.restore();
	expect(frame.HandleUserActionToggleSelf).toBe(nativeToggle);
	frame.HandleUserActionToggleSelf();
	expect(nativeToggle).toHaveBeenCalledOnce();
});
it("raises the quest pane after M's native show and positioning pass completes", () => {
	const { client, frame, quests, events, scripts, layout } = setup();
	let positioned = false;
	const raisedAfterPositioning: boolean[] = [];
	layout.bind.mockImplementation((target, rule) => {
		if (target === quests && rule.raised)
			raisedAfterPositioning.push(positioned);
	});
	events.subscribe("MAP_VISIBILITY_CHANGED", () => {
		if (client.isOpen())
			client.mount(
				{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
				{} as Frame,
			);
	});
	vi.stubGlobal("ShowUIPanel", () => {
		frame.IsShown.mockReturnValue(true);
		scripts.get("OnShow")?.();
		positioned = true;
	});
	frame.IsShown.mockReturnValue(false);
	client.disable();
	frame.HandleUserActionToggleSelf();
	expect(raisedAfterPositioning.at(-1)).toBe(true);
});
it("retains the native canvas, breadcrumbs and filters while owning a fullscreen layout and restoring it on close", () => {
	const { client, frame, quests, layout, events, scripts } = setup();
	const changed = vi.fn();
	events.subscribe("MAP_VISIBILITY_CHANGED", changed);
	client.disable();
	scripts.get("OnShow")?.();
	expect(changed).toHaveBeenCalled();
	const parent = { getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		pane = {} as Frame;
	client.mount(parent, pane);
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({
			parent,
			reparent: true,
			scale: 1,
			strata: "DIALOG",
			frameBuffer: false,
		}),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		frame.ScrollContainer,
		expect.objectContaining({
			parent: frame,
			anchors: [["TOPLEFT", "TOPLEFT", 0, -32]],
			size: [864, 576],
			clip: true,
		}),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		frame.NavBar,
		expect.objectContaining({ parent: frame.TitleCanvasSpacerFrame }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests,
		expect.objectContaining({
			parent: pane,
			levelOffset: 1,
			raised: true,
			visible: true,
			alpha: 1,
			mouse: true,
		}),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame,
		expect.objectContaining({ visible: true, insets: [0, 0, 0, 0] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame.ScrollFrame,
		expect.objectContaining({
			visible: true,
			insets: [0, 0, 0, 0],
			clip: true,
		}),
	);
	expect(frame.OnFrameSizeChanged).toHaveBeenCalled();
	client.unmount();
	expect(layout.release).toHaveBeenCalled();
	client.restore();
	changed.mockClear();
	scripts.get("OnShow")?.();
	expect(changed).not.toHaveBeenCalled();
});
it("navigates Blizzard's visible headers and quest rows in native layout order and toggles native collapse state", () => {
	const { client, quests, layout, hooks, events } = setup();
	const header = { IsShown: () => true, questLogIndex: 1, layoutIndex: 1 };
	const quest = { IsShown: () => true, questID: 7, layoutIndex: 2 };
	const hidden = { IsShown: () => false, questID: 8, layoutIndex: 3 };
	Object.assign(quests.QuestsFrame.ScrollFrame, {
		headerFramePool: { EnumerateActive: () => [header] },
		titleFramePool: { EnumerateActive: () => [hidden, quest] },
		campaignHeaderFramePool: { EnumerateActive: () => [] },
		campaignHeaderMinimalFramePool: { EnumerateActive: () => [] },
		covenantCallingsHeaderFramePool: { EnumerateActive: () => [] },
	});
	vi.stubGlobal("C_QuestLog", {
		GetInfo: vi.fn(() => ({ isCollapsed: false })),
	});
	vi.stubGlobal("CollapseQuestHeader", vi.fn());
	vi.stubGlobal("ExpandQuestHeader", vi.fn());
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	const rows = client.navigation();
	expect(rows.map((row) => row.node.navId)).toEqual([
		"map-header-1",
		"map-quest-7",
	]);
	expect(rows.at(1)?.questID).toBe(7);
	rows.at(0)?.node.onInteract();
	expect(CollapseQuestHeader).toHaveBeenCalledWith(1);
	vi.mocked(C_QuestLog.GetInfo).mockReturnValue({ isCollapsed: true } as never);
	rows.at(0)?.node.onInteract();
	expect(ExpandQuestHeader).toHaveBeenCalledWith(1);
	expect(layout.navigation).toHaveBeenCalledWith(
		header,
		quests.QuestsFrame.ScrollFrame,
		"map-header-1",
		expect.any(Function),
	);
	const refreshed = vi.fn();
	events.subscribe("QUEST_LOG_UPDATE", refreshed);
	hooks.get("QuestLogQuests_Update")?.();
	expect(refreshed).toHaveBeenCalledOnce();
	client.unmount();
	hooks.get("QuestLogQuests_Update")?.();
	expect(refreshed).toHaveBeenCalledOnce();
});
it("keeps category navigation identity when log indices and display titles change after collapse", () => {
	const { client, quests } = setup();
	const header = { IsShown: () => true, questLogIndex: 8, layoutIndex: 4 };
	Object.assign(quests.QuestsFrame.ScrollFrame, {
		headerFramePool: { EnumerateActive: () => [header] },
		titleFramePool: { EnumerateActive: () => [] },
		campaignHeaderFramePool: { EnumerateActive: () => [] },
		campaignHeaderMinimalFramePool: { EnumerateActive: () => [] },
		covenantCallingsHeaderFramePool: { EnumerateActive: () => [] },
	});
	vi.stubGlobal("C_QuestLog", {
		GetInfo: vi.fn(() => ({
			headerSortKey: 42,
			title: "Local quests",
			isCollapsed: false,
		})),
	});
	vi.stubGlobal("CollapseQuestHeader", vi.fn());
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	const id = client.navigation().at(0)?.node.navId;
	header.questLogIndex = 3;
	vi.mocked(C_QuestLog.GetInfo).mockReturnValue({
		headerSortKey: 42,
		title: "Local quests (collapsed)",
		isCollapsed: false,
	} as never);
	const row = client.navigation().at(0);
	expect(row?.node.navId).toBe(id);
	row?.node.onInteract();
	expect(CollapseQuestHeader).toHaveBeenCalledWith(3);
});

it("uses the displayed category sort key when quest log lookup changes during a rebuild", () => {
	const { client, quests } = setup();
	const header = {
		IsShown: () => true,
		questLogIndex: 8,
		layoutIndex: 4,
		sortKey: 42,
	};
	Object.assign(quests.QuestsFrame.ScrollFrame, {
		headerFramePool: { EnumerateActive: () => [header] },
		titleFramePool: { EnumerateActive: () => [] },
		campaignHeaderFramePool: { EnumerateActive: () => [] },
		campaignHeaderMinimalFramePool: { EnumerateActive: () => [] },
		covenantCallingsHeaderFramePool: { EnumerateActive: () => [] },
	});
	vi.stubGlobal("C_QuestLog", {
		GetInfo: vi.fn(() => undefined),
	});
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	expect(client.navigation().at(0)?.node.navId).toBe("map-header-42");
	header.questLogIndex = 3;
	expect(client.navigation().at(0)?.node.navId).toBe("map-header-42");
});

it("leaves the metal header exposed above breadcrumbs, quests and details", () => {
	const { client, frame, quests, layout, hooks } = setup();
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({ insets: [8, 66, 328, 46] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests,
		expect.objectContaining({ insets: [8, 20, 8, 40] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		frame.NavBar,
		expect.objectContaining({ insets: [8, 4, 8, 4] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame.ScrollFrame,
		expect.objectContaining({ insets: [0, 0, 0, 0] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame.ScrollFrame.SearchBox,
		{ visible: false },
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame.ScrollFrame.SettingsDropdown,
		{ visible: false },
	);
	hooks.get("QuestMapFrame_ShowQuestDetails")?.(7);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.DetailsFrame,
		expect.objectContaining({ visible: true, insets: [0, 0, 0, 0] }),
	);
});

it("converts quest log headers and campaign membership without dropping dailies or local stories", () => {
	const { client } = setup();
	const entries = [
		{ title: "Zone", isHeader: true },
		{ questID: 1, title: "Campaign" },
		{ questID: 2, title: "Daily" },
		{ questID: 3, title: "Local story" },
		{ questID: 4, title: "Hidden", isHidden: true },
	];
	vi.stubGlobal("C_QuestLog", {
		GetNumQuestLogEntries: () => [entries.length, 4],
		GetInfo: (i: number) => entries.at(i - 1),
		GetQuestObjectives: () => [{ text: "Do the thing" }],
		CanAbandonQuest: () => true,
		IsPushableQuest: (id: number) => id === 2,
	});
	vi.stubGlobal("C_CampaignInfo", {
		IsCampaignQuest: (id: number) => id === 1,
	});
	vi.stubGlobal("QuestUtils_IsQuestWatched", (id: number) => id === 1);
	vi.stubGlobal("IsInGroup", () => true);
	expect(client.read()).toEqual(
		[1, 2, 3].map((id) => ({
			id,
			title: entries.at(id)?.title,
			campaign: id === 1,
			zone: "Zone",
			objectives: ["Do the thing"],
			tracked: id === 1,
			superTracked: id === 1,
			canAbandon: true,
			canShare: id === 2,
		})),
	);
});

it("fits map art below the title and breadcrumbs across map changes and resizing", () => {
	const { client, frame, layout, hooks } = setup();
	vi.mocked(C_Map.GetMapArtLayers).mockImplementation(
		(id: number) =>
			(id === 102
				? [{ layerWidth: 1000, layerHeight: 1000 }]
				: [{ layerWidth: 1500, layerHeight: 1000 }]) as unknown as number,
	);
	const size = { width: 1200, height: 720 };
	client.disable();
	client.mount({ getSize: () => size } as Frame, {} as Frame);
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({ insets: [8, 66, 328, 46] }),
	);
	const viewport = () =>
		layout.bind.mock.calls
			.filter((call) => call.at(0) === frame.ScrollContainer)
			.at(-1)
			?.at(1);
	expect(viewport()).toMatchObject({
		anchors: [["TOPLEFT", "TOPLEFT", 0, -32]],
		size: [864, 576],
	});
	frame.GetMapID.mockReturnValue(102);
	hooks.get("OnMapChanged")?.();
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({ insets: [114, 28, 434, 8] }),
	);
	expect(viewport()).toMatchObject({
		anchors: [["TOPLEFT", "TOPLEFT", 0, -32]],
		size: [652, 652],
	});
	frame.GetMapID.mockReturnValue(103);
	hooks.get("OnMapChanged")?.();
	expect(viewport()).toMatchObject({ size: [864, 576] });
	size.width = 1400;
	size.height = 900;
	client.resize();
	expect(viewport()).toMatchObject({ size: [1064, 1064 / 1.5] });
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({
			insets: [
				8,
				20 + (900 - 52 - 1064 / 1.5) / 2,
				328,
				(900 - 52 - 1064 / 1.5) / 2,
			],
		}),
	);
	const calls = layout.bind.mock.calls.length;
	client.unmount();
	hooks.get("OnMapChanged")?.();
	expect(layout.bind.mock.calls).toHaveLength(calls);
});

it("toggles the active navigation quest without changing ordinary tracking", () => {
	const { client } = setup();
	vi.stubGlobal("C_QuestLog", { GetLogIndexForQuestID: () => 1 });
	client.superTrack(1);
	client.superTrack(2);
	expect(C_SuperTrack.SetSuperTrackedQuestID).toHaveBeenNthCalledWith(1, 0);
	expect(C_SuperTrack.SetSuperTrackedQuestID).toHaveBeenNthCalledWith(2, 2);
	expect(QuestMapQuestOptions_TrackQuest).not.toHaveBeenCalled();
});
it("focuses a quest without opening details, uses native details and safe abandon confirmation, and validates sharing", () => {
	const { client, frame, layout, quests } = setup();
	vi.stubGlobal("C_QuestLog", {
		GetLogIndexForQuestID: () => 1,
		CanAbandonQuest: () => true,
		IsPushableQuest: () => true,
	});
	vi.stubGlobal("IsInGroup", () => false);
	client.disable();
	client.mount(
		{ getSize: () => ({ width: 1200, height: 720 }) } as Frame,
		{} as Frame,
	);
	client.focus(12);
	expect(frame.SetMapID).toHaveBeenCalledWith(101);
	expect(frame.SetFocusedQuestID).toHaveBeenCalledWith(12);
	expect(QuestMapFrame_ShowQuestDetails).not.toHaveBeenCalled();
	client.showDetails(12);
	expect(QuestMapFrame_ShowQuestDetails).toHaveBeenCalledWith(12);
	client.scrollDetails(1);
	expect(layout.scroll).toHaveBeenCalledWith(
		quests.DetailsFrame.ScrollFrame.ScrollBar,
		1,
	);
	client.hideDetails();
	expect(QuestMapFrame_ReturnFromQuestDetails).toHaveBeenCalled();
	client.track(12);
	expect(QuestMapQuestOptions_TrackQuest).toHaveBeenCalledWith(12);
	client.share(12);
	expect(QuestMapQuestOptions_ShareQuest).not.toHaveBeenCalled();
	vi.stubGlobal("IsInGroup", () => true);
	client.share(12);
	expect(QuestMapQuestOptions_ShareQuest).toHaveBeenCalledWith(12);
});

it("abandons only a still-abandonable quest after controller confirmation, preserving native selection", () => {
	const { client } = setup();
	const api = {
		GetLogIndexForQuestID: () => 1,
		CanAbandonQuest: vi.fn(() => true),
		GetSelectedQuest: () => 99,
		SetSelectedQuest: vi.fn(),
		SetAbandonQuest: vi.fn(),
		AbandonQuest: vi.fn(),
	};
	vi.stubGlobal("C_QuestLog", api);
	client.abandon(12);
	expect(api.SetSelectedQuest.mock.calls).toEqual([[12], [99]]);
	expect(api.SetAbandonQuest).toHaveBeenCalledOnce();
	expect(api.AbandonQuest).toHaveBeenCalledOnce();
	api.CanAbandonQuest.mockReturnValue(false);
	client.abandon(12);
	expect(api.AbandonQuest).toHaveBeenCalledOnce();
});

it.each([undefined, null, 0])(
	"ignores quests removed before an action runs (index %s)",
	(index) => {
		const { client, frame } = setup();
		vi.stubGlobal("C_QuestLog", {
			GetLogIndexForQuestID: () => index,
			CanAbandonQuest: () => true,
			IsPushableQuest: () => true,
		});
		vi.stubGlobal("IsInGroup", () => true);
		client.focus(12);
		client.showDetails(12);
		client.track(12);
		client.share(12);
		expect(frame.SetMapID).not.toHaveBeenCalled();
		expect(QuestMapFrame_ShowQuestDetails).not.toHaveBeenCalled();
		expect(QuestMapQuestOptions_TrackQuest).not.toHaveBeenCalled();
		expect(QuestMapQuestOptions_ShareQuest).not.toHaveBeenCalled();
	},
);
