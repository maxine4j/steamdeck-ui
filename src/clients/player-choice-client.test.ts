import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import {
	type NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import { PlayerChoiceClient } from "./player-choice-client";

afterEach(() => vi.unstubAllGlobals());

function frame(button = false, x = 0, y = 100) {
	const children: NativeDialogFrame[] = [];
	const scripts = new Map<string, () => void>();
	return {
		GetChildren: () => children,
		IsVisible: vi.fn(() => true),
		IsEnabled: vi.fn(() => true),
		IsObjectType: (type: string) => button && type === "Button",
		GetTop: () => y,
		GetLeft: () => x,
		GetScript: () => undefined,
		HookScript: (script: string, callback: () => void) =>
			scripts.set(script, callback),
		Click: vi.fn(),
		children,
		scripts,
	};
}

function setup(loaded = true) {
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	const pending: (() => void)[] = [];
	const host = {
		...frame(),
		optionFrames: [] as NativeDialogFrame[],
		OnCloseUIFromExitButton: vi.fn(),
	};
	const globals: { PlayerChoiceFrame?: typeof host } = loaded
		? { PlayerChoiceFrame: host }
		: {};
	vi.stubGlobal("_G", globals);
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(_target: unknown, method: string, callback: () => void) =>
			hooks.set(method, callback),
	);
	const targets = new Map<string, NativeDialogFrame>();
	const controls = new NativeDialogNavigation({
		navigation: (target, _scroll, navId, onInteract) => {
			targets.set(navId, target as NativeDialogFrame);
			return { navId, onFocus: vi.fn(), onBlur: vi.fn(), onInteract };
		},
		release: vi.fn(),
	});
	const client = new PlayerChoiceClient(events, controls, {
		nextFrame: (callback) => {
			pending.push(callback);
			return () => {
				const index = pending.indexOf(callback);
				if (index >= 0) pending.splice(index, 1);
			};
		},
	});
	return {
		client,
		host,
		globals,
		hooks,
		events,
		changed,
		targets,
		flush: () => {
			for (const callback of pending.splice(0)) callback();
		},
	};
}

it("navigates only visible enabled response actions across normal, delve and Torghast choices", () => {
	const s = setup();
	const option = frame();
	const response = (id: number, x: number, y = 100) => ({
		...frame(true, x, y),
		buttonID: id,
		parentOption: option,
	});
	const left = response(1, 0),
		right = response(2, 300),
		lower = response(3, 0, 50);
	const disabled = response(4, 500),
		hidden = response(5, 600);
	disabled.IsEnabled.mockReturnValue(false);
	hidden.IsVisible.mockReturnValue(false);
	const close = frame(true, 900, 900),
		reward = frame(true),
		reroll = frame(true);
	const preview = { ...frame(true), buttonID: 6 };
	option.children.push(right, reward, lower, left, disabled, hidden, preview);
	s.host.children.push(close, option, reroll);
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	expect(dialog).toBeDefined();
	expect(
		dialog?.grid.map((row) => row.map((node) => s.targets.get(node.navId))),
	).toEqual([[left, right], [lower]]);
	dialog?.grid.at(0)?.at(1)?.onInteract();
	expect(right.Click).toHaveBeenCalledOnce();
	expect(close.Click).not.toHaveBeenCalled();
	s.flush();
	s.changed.mockClear();
	disabled.IsEnabled.mockReturnValue(true);
	s.hooks.get("Enable")?.();
	s.flush();
	expect(s.changed).toHaveBeenCalledOnce();
	expect(s.client.getDialogs().at(0)?.grid.flat()).toHaveLength(4);
});

it("supports selectable grid cards and their response buttons without unrelated controls", () => {
	const s = setup();
	const card = frame(true);
	const action = { ...frame(true, 300), buttonID: 10, parentOption: card };
	s.host.optionFrames.push(card);
	s.host.children.push(frame(true), card, action);
	s.client.initialize();
	const nodes = s.client.getDialogs().at(0)?.grid.flat();
	expect(nodes?.map((node) => s.targets.get(node.navId))).toEqual([
		card,
		action,
	]);
	nodes?.at(0)?.onInteract();
	expect(card.Click).toHaveBeenCalledOnce();
});

it("discovers lazy loading and refreshes rebuilt options and pages while shown", () => {
	const s = setup(false);
	s.client.initialize();
	expect(s.client.getDialogs()).toEqual([]);
	s.globals.PlayerChoiceFrame = s.host;
	s.events.emit("DIALOGUE_ADDON_LOADED");
	s.flush();
	s.changed.mockClear();
	const action = { ...frame(true), buttonID: 1, parentOption: s.host };
	s.host.children.push(action);
	s.hooks.get("SetupOptions")?.();
	s.hooks.get("OnPageChanged")?.();
	s.flush();
	expect(s.changed).toHaveBeenCalledOnce();
	expect(s.client.getDialogs().at(0)?.grid.flat()).toHaveLength(1);
	s.host.IsVisible.mockReturnValue(false);
	s.host.scripts.get("OnHide")?.();
	s.flush();
	expect(s.client.getDialogs()).toEqual([]);
});

it("uses Blizzard's close handler for B and ignores stale callbacks after shutdown", () => {
	const s = setup();
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	dialog?.cancel();
	expect(s.host.OnCloseUIFromExitButton).toHaveBeenCalledOnce();
	s.host.IsVisible.mockReturnValue(false);
	dialog?.cancel();
	expect(s.host.OnCloseUIFromExitButton).toHaveBeenCalledOnce();
	s.host.IsVisible.mockReturnValue(true);
	s.client.shutdown();
	dialog?.cancel();
	s.events.emit("DIALOGUE_ADDON_LOADED");
	s.hooks.get("SetupOptions")?.();
	s.flush();
	expect(s.changed).not.toHaveBeenCalled();
	expect(s.client.getDialogs()).toEqual([]);
	expect(s.host.OnCloseUIFromExitButton).toHaveBeenCalledOnce();
});
