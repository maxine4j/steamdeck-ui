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
		IsShown: vi.fn(() => true),
		HookScript: (name: string, callback: () => void) =>
			scripts.set(name, callback),
		OnFrameSizeChanged: vi.fn(),
		SetMapID: vi.fn(),
		GetMapID: vi.fn(() => 101),
		SetFocusedQuestID: vi.fn(),
		HandleUserActionToggleSelf: vi.fn(),
		TitleCanvasSpacerFrame: {},
		ScrollContainer: {},
		NavBar: {},
		BorderFrame: {},
		BlackoutFrame: {},
		SidePanelToggle: {},
	};
	const quests = {
		ContentsAnchor: {},
		QuestsFrame: { ScrollFrame: {} },
		DetailsFrame: { ScrollFrame: { ScrollBar: {} } },
		QuestsTab: {},
		EventsTab: {},
		MapLegendTab: {},
		EventsFrame: {},
		MapLegend: {},
		QuestSessionManagement: {},
	};
	vi.stubGlobal("WorldMapFrame", frame);
	vi.stubGlobal("C_Map", {
		GetMapArtLayers: vi.fn(() => [
			{ layerWidth: 1000, layerHeight: 666.6666666666666 },
		]),
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
	vi.stubGlobal("QuestLogQuests_Update", vi.fn());
	return {
		events,
		hooks,
		scripts,
		frame,
		quests,
		layout,
		client: new MapClient(events, layout, layout),
	};
}
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
			anchors: [["TOPLEFT", "TOPLEFT", 0, -48]],
			size: [780, 520],
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
			visible: true,
			alpha: 1,
			mouse: true,
		}),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame,
		expect.objectContaining({ visible: true, insets: [0, 0, 22, 0] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests.QuestsFrame.ScrollFrame,
		expect.objectContaining({
			visible: true,
			insets: [0, 29, 0, 0],
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

it("keeps map art top-aligned and fitted to the left pane across map changes and resizing", () => {
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
		expect.objectContaining({ insets: [0, 0, 420, 152] }),
	);
	const viewport = () =>
		layout.bind.mock.calls
			.filter((call) => call.at(0) === frame.ScrollContainer)
			.at(-1)
			?.at(1);
	expect(viewport()).toMatchObject({
		anchors: [["TOPLEFT", "TOPLEFT", 0, -48]],
		size: [780, 520],
	});
	frame.GetMapID.mockReturnValue(102);
	hooks.get("OnMapChanged")?.();
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({ insets: [0, 0, 528, 0] }),
	);
	expect(viewport()).toMatchObject({
		anchors: [["TOPLEFT", "TOPLEFT", 0, -48]],
		size: [672, 672],
	});
	frame.GetMapID.mockReturnValue(103);
	hooks.get("OnMapChanged")?.();
	expect(viewport()).toMatchObject({ size: [780, 520] });
	size.width = 1400;
	size.height = 900;
	client.resize();
	expect(viewport()).toMatchObject({ size: [980, 980 / 1.5] });
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
