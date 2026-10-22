import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { PreyMapClient } from "./prey-map-client";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const visible = () => ({ IsVisible: vi.fn(() => true) });
	const pin = (questID: number, x: number, y: number) => ({
		...visible(),
		questID,
		GetPosition: () => [x, y],
		GetGlobalPosition: () => [x, y],
		OnClick: vi.fn(),
		OnMouseEnter: vi.fn(),
		OnMouseLeave: vi.fn(),
	});
	const pins = [pin(30, 0.8, 0.7), pin(20, 0.7, 0.2), pin(10, 0.2, 0.2)];
	const host = {
		...visible(),
		CloseButton: { Click: vi.fn() },
		MapTab: {
			...visible(),
			EnumeratePinsByTemplate: (template: string) =>
				template === "AdventureMap_QuestOfferPinTemplate" ? pins : [],
		},
	};
	const quest = {
		...visible(),
		AcceptButton: {},
		DeclineButton: {},
		DeclineQuest: vi.fn(),
	};
	quest.IsVisible.mockReturnValue(false);
	const globals: Record<string, unknown> = {
		CovenantMissionFrame: host,
		AdventureMapQuestChoiceDialog: quest,
	};
	vi.stubGlobal("_G", globals);
	const texture = vi.fn(() => "midnight");
	vi.stubGlobal("C_AdventureMap", { GetAdventureMapTextureKit: texture });
	const hooks = new Map<unknown, Map<string, () => void>>();
	vi.stubGlobal(
		"hooksecurefunc",
		(frame: unknown, method: string, callback: () => void) => {
			if (!hooks.has(frame)) hooks.set(frame, new Map());
			hooks.get(frame)?.set(method, callback);
		},
	);
	const observers = new Map<unknown, () => void>();
	const controls = {
		watch: vi.fn((frame: unknown, notify: () => void) =>
			observers.set(frame, notify),
		),
		grid: vi.fn(() => [
			[
				{
					navId: "accept",
					onFocus: vi.fn(),
					onBlur: vi.fn(),
					onInteract: vi.fn(),
				},
			],
		]),
		release: vi.fn(),
	};
	const navigation = {
		navigation: vi.fn((_frame, _scroll, navId, onInteract, hover) => ({
			navId,
			onInteract,
			onFocus: () => hover?.enter(),
			onBlur: () => hover?.leave(),
		})),
	};
	const callbacks: (() => void)[] = [];
	const scheduler = {
		nextFrame: (callback: () => void) => {
			callbacks.push(callback);
			return vi.fn();
		},
	};
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	const client = new PreyMapClient(events, navigation, controls, scheduler);
	return {
		client,
		host,
		quest,
		pins,
		globals,
		texture,
		hooks,
		observers,
		controls,
		events,
		changed,
		flush: () => {
			for (const callback of callbacks.splice(0)) callback();
		},
	};
}

it("navigates Prey offers in map order with stable quest identities and native actions", () => {
	const s = setup();
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	expect(dialog?.id).toBe("native-prey-map");
	expect(dialog?.grid.map((row) => row.map((node) => node.navId))).toEqual([
		["prey:offer:10", "prey:offer:20"],
		["prey:offer:30"],
	]);
	const node = dialog?.grid.at(0)?.at(0);
	node?.onFocus();
	node?.onInteract();
	node?.onBlur();
	expect(s.pins.at(2)?.OnMouseEnter).toHaveBeenCalledOnce();
	expect(s.pins.at(2)?.OnClick).toHaveBeenCalledWith("LeftButton");
	expect(s.pins.at(2)?.OnMouseLeave).toHaveBeenCalledOnce();
	dialog?.cancel();
	expect(s.host.CloseButton.Click).toHaveBeenCalledWith("LeftButton");
});

it("puts quest confirmation above the map, declines on cancel, and excludes other adventure maps", () => {
	const s = setup();
	s.client.initialize();
	s.quest.IsVisible.mockReturnValue(true);
	const dialogs = s.client.getDialogs();
	expect(dialogs.map((dialog) => dialog.id)).toEqual([
		"native-prey-map",
		"native-prey-quest",
	]);
	expect(dialogs.at(1)?.grid.at(0)?.at(0)?.navId).toBe("accept");
	dialogs.at(1)?.cancel();
	expect(s.quest.DeclineQuest).toHaveBeenCalledOnce();
	expect(s.host.CloseButton.Click).not.toHaveBeenCalled();
	s.texture.mockReturnValue("covenantGarrisonStyleData");
	expect(s.client.getDialogs()).toEqual([]);
});

it("orders inset offers by their position on the full map", () => {
	const s = setup();
	const insetPin = s.pins.at(0);
	if (!insetPin) throw new Error("Missing inset pin");
	insetPin.GetPosition = () => [0.1, 0.1];
	s.client.initialize();
	expect(s.client.getDialogs().at(0)?.grid.at(-1)?.at(0)?.navId).toBe(
		"prey:offer:30",
	);
});

it("discovers late loaded frames, coalesces recycled pin updates, and stops observing on shutdown", () => {
	const s = setup();
	delete s.globals.CovenantMissionFrame;
	delete s.globals.AdventureMapQuestChoiceDialog;
	s.client.initialize();
	expect(s.client.getDialogs()).toEqual([]);
	Object.assign(s.globals, {
		CovenantMissionFrame: s.host,
		AdventureMapQuestChoiceDialog: s.quest,
	});
	s.events.emit("DIALOGUE_ADDON_LOADED");
	expect(s.observers.has(s.host.MapTab)).toBe(true);
	s.hooks.get(s.host.MapTab)?.get("RefreshAllDataProviders")?.();
	s.hooks.get(s.host.MapTab)?.get("RemovePin")?.();
	s.flush();
	expect(s.changed).toHaveBeenCalledOnce();
	s.client.shutdown();
	s.changed.mockClear();
	s.hooks.get(s.host.MapTab)?.get("RefreshAllDataProviders")?.();
	s.events.emit("DIALOGUE_ADDON_LOADED");
	s.flush();
	expect(s.changed).not.toHaveBeenCalled();
	expect(s.controls.release).toHaveBeenCalledOnce();
});

it("does not consult the adventure map API before its host exists", () => {
	const s = setup();
	vi.unstubAllGlobals();
	vi.stubGlobal("_G", {});
	s.client.initialize();
	expect(s.client.getDialogs()).toEqual([]);
});
