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
		SetFocusedQuestID: vi.fn(),
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
	const layout = { bind: vi.fn(), release: vi.fn(), scroll: vi.fn() };
	return {
		events,
		hooks,
		scripts,
		frame,
		quests,
		layout,
		client: new MapClient(events, layout),
	};
}
it("retains the native canvas, breadcrumbs and filters while owning a fullscreen layout and restoring it on close", () => {
	const { client, frame, quests, layout, events, scripts } = setup();
	const changed = vi.fn();
	events.subscribe("MAP_VISIBILITY_CHANGED", changed);
	client.disable();
	scripts.get("OnShow")?.();
	expect(changed).toHaveBeenCalled();
	const parent = {} as Frame,
		pane = {} as Frame;
	client.mount(parent, pane);
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({
			parent,
			reparent: true,
			scale: 1,
			strata: "DIALOG",
		}),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		frame.ScrollContainer,
		expect.objectContaining({ parent: frame, insets: [0, 48, 420, 0] }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		frame.NavBar,
		expect.objectContaining({ parent: frame.TitleCanvasSpacerFrame }),
	);
	expect(layout.bind).toHaveBeenCalledWith(
		quests,
		expect.objectContaining({ parent: pane, visible: false }),
	);
	expect(frame.OnFrameSizeChanged).toHaveBeenCalled();
	client.unmount();
	expect(layout.release).toHaveBeenCalled();
	client.restore();
	changed.mockClear();
	scripts.get("OnShow")?.();
	expect(changed).not.toHaveBeenCalled();
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
	client.mount({} as Frame, {} as Frame);
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
