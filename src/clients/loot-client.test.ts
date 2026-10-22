import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { NativeDialogNavigation } from "../ui/components/native-dialog-navigation";
import { LootClient } from "./loot-client";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	const item = {
		IsVisible: vi.fn(() => true),
		IsEnabled: () => true,
		IsObjectType: () => false,
		Click: vi.fn(),
		GetScript: (script: string) => (script === "OnEnter" ? enter : leave),
	};
	const enter = vi.fn();
	const leave = vi.fn();
	const data = [{ slotIndex: 1 }, { slotIndex: 2 }, { slotIndex: 3 }];
	const scroll = {
		ForEachElementData: (callback: (entry: (typeof data)[number]) => void) =>
			data.forEach(callback),
		ScrollToElementData: vi.fn(),
		FindFrame: vi.fn(() => ({ Item: item })),
	};
	const host = {
		IsVisible: vi.fn(() => true),
		ScrollBox: scroll,
		ClosePanelButton: item,
	};
	vi.stubGlobal("_G", {
		LootFrame: host,
		GetLootSlotType: (slot: number) => (slot === 2 ? 0 : 1),
	});
	vi.stubGlobal("hooksecurefunc", vi.fn());
	const controls = new NativeDialogNavigation({
		navigation: (_frame, _scroll, navId, onInteract, hover) => ({
			navId,
			onInteract,
			onFocus: () => hover?.enter(),
			onBlur: () => hover?.leave(),
		}),
		release: vi.fn(),
	});
	vi.spyOn(controls, "watch").mockImplementation(() => {});
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	const callbacks: (() => void)[] = [];
	const client = new LootClient(events, controls, {
		nextFrame: (callback) => {
			callbacks.push(callback);
			return vi.fn();
		},
	});
	return {
		client,
		item,
		enter,
		leave,
		host,
		scroll,
		data,
		changed,
		events,
		flush: () => {
			for (const callback of callbacks.splice(0)) callback();
		},
	};
}

it("navigates logical loot slots, scrolls to recycled rows and uses native item actions and tooltips", () => {
	const s = setup();
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	expect(dialog?.grid.flat().map((node) => node.navId)).toEqual([
		"loot:slot:1",
		"loot:slot:3",
		"loot:close",
	]);
	const node = dialog?.grid.at(1)?.at(0);
	node?.onFocus();
	node?.onInteract();
	node?.onBlur();
	expect(s.scroll.ScrollToElementData).toHaveBeenCalledWith(
		s.data.at(2),
		0.5,
		0,
		true,
	);
	expect(s.item.Click).toHaveBeenCalledWith("LeftButton");
	expect(s.enter).toHaveBeenCalledOnce();
	expect(s.leave).toHaveBeenCalledOnce();
	dialog?.cancel();
	expect(s.item.Click).toHaveBeenCalledTimes(2);
});

it("refreshes after injected loot changes and stops reacting after shutdown", () => {
	const s = setup();
	s.client.initialize();
	s.flush();
	s.changed.mockClear();
	s.events.emit("LOOT_UPDATED");
	s.events.emit("LOOT_UPDATED");
	s.flush();
	expect(s.changed).toHaveBeenCalledOnce();
	s.host.IsVisible.mockReturnValue(false);
	expect(s.client.getDialogs()).toEqual([]);
	s.client.shutdown();
	s.changed.mockClear();
	s.events.emit("LOOT_UPDATED");
	s.flush();
	expect(s.changed).not.toHaveBeenCalled();
});
