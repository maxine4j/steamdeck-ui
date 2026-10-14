import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { NativeDialogFrame } from "../ui/components/native-dialog-navigation";
import { NativeDialogsClient } from "./native-dialogs-client";

afterEach(() => vi.unstubAllGlobals());
function setup() {
	const globals: Record<string, unknown> = {};
	vi.stubGlobal("_G", globals);
	const callbacks: (() => void)[] = [];
	const scheduler = {
		nextFrame: vi.fn((callback: () => void) => {
			callbacks.push(callback);
			return vi.fn();
		}),
	};
	const observers = new Map<NativeDialogFrame, () => void>();
	const controls = {
		watch: vi.fn((frame: NativeDialogFrame, callback: () => void) =>
			observers.set(frame, callback),
		),
		grid: vi.fn(() => []),
		click: vi.fn(),
		release: vi.fn(),
	};
	const hooks = new Map<string, (frame: NativeDialogFrame) => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(name: string, callback: (frame: NativeDialogFrame) => void) =>
			hooks.set(name, callback),
	);
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	const client = new NativeDialogsClient(events, controls, scheduler);
	return {
		globals,
		observers,
		controls,
		hooks,
		client,
		changed,
		flush: () => {
			for (const callback of callbacks.splice(0)) callback();
		},
	};
}
function dialog() {
	return { IsVisible: vi.fn(() => false), hideOnEscape: true };
}

it("discovers menu, static and queue dialogs, orders popups above the menu, and batches changes", () => {
	const s = setup();
	const menu = dialog(),
		invite = dialog(),
		queue = dialog();
	Object.assign(s.globals, {
		GameMenuFrame: menu,
		StaticPopup1: invite,
		LFGDungeonReadyPopup: queue,
	});
	s.client.initialize();
	expect(s.controls.watch).toHaveBeenCalledTimes(3);
	for (const frame of [invite, queue, menu]) {
		frame.IsVisible.mockReturnValue(true);
		s.observers.get(frame as unknown as NativeDialogFrame)?.();
	}
	expect(s.changed).not.toHaveBeenCalled();
	s.flush();
	expect(s.changed).toHaveBeenCalledOnce();
	expect(s.client.getDialogs().map((dialog) => dialog.id)).toEqual([
		"native-GameMenuFrame",
		"native-StaticPopup1",
		"native-LFGDungeonReadyPopup",
	]);
	expect(s.controls.grid).toHaveBeenCalledWith(
		"native-GameMenuFrame",
		menu,
		true,
	);
	invite.IsVisible.mockReturnValue(false);
	expect(s.client.getDialogs().map((dialog) => dialog.id)).not.toContain(
		"native-StaticPopup1",
	);
});

it("discovers special popups and preserves native cancel behaviour without accepting a prompt", () => {
	const s = setup();
	const menu = dialog(),
		invite = dialog();
	menu.IsVisible.mockReturnValue(true);
	invite.IsVisible.mockReturnValue(true);
	const escapeMenu = vi.fn(),
		escapePopup = vi.fn();
	Object.assign(s.globals, {
		GameMenuFrame: menu,
		StaticPopup1: invite,
		GameMenuFrame_EscapePressed: escapeMenu,
		StaticPopup_EscapePressed: escapePopup,
	});
	s.client.initialize();
	s.client.getDialogs().at(0)?.cancel();
	s.client.getDialogs().at(1)?.cancel();
	expect(escapeMenu).toHaveBeenCalledOnce();
	expect(escapePopup).toHaveBeenCalledOnce();
	const special = { ...dialog(), GetName: () => "LaterPopup" };
	special.IsVisible.mockReturnValue(true);
	s.hooks.get("StaticPopupSpecial_Show")?.(
		special as unknown as NativeDialogFrame,
	);
	expect(s.client.getDialogs().at(-1)?.id).toBe("native-LaterPopup");
	special.hideOnEscape = false;
	s.client.getDialogs().at(-1)?.cancel();
	expect(escapePopup).toHaveBeenCalledOnce();
	s.client.shutdown();
	s.flush();
	expect(s.controls.release).toHaveBeenCalledOnce();
	expect(s.changed).not.toHaveBeenCalled();
});
