import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { NativeDialogFrame } from "../ui/components/native-dialog-navigation";
import {
	type NativeDialog,
	NativeDialogsClient,
} from "./native-dialogs-client";

afterEach(() => vi.unstubAllGlobals());

it("acknowledges an informational group invite on Back", () => {
	const s = setup();
	const native = dialog(),
		decline = dialog(),
		acknowledge = dialog();
	native.IsVisible.mockReturnValue(true);
	decline.IsVisible.mockReturnValue(false);
	Object.assign(native, {
		DeclineButton: decline,
		AcknowledgeButton: acknowledge,
	});
	s.globals.LFGListInviteDialog = native;
	s.client.initialize();
	s.client
		.getDialogs()
		.find((entry) => entry.id === "native-LFGListInviteDialog")
		?.cancel();
	expect(s.controls.control).toHaveBeenCalledWith(
		"native-LFGListInviteDialog:cancel",
		acknowledge,
	);
});

it.each(["LFGListApplicationDialog", "LFGListInviteDialog"])(
	"traps and cancels the native %s through its own cancel action",
	(name) => {
		const s = setup();
		const native = dialog();
		native.IsVisible.mockReturnValue(true);
		const cancel = dialog();
		cancel.IsVisible.mockReturnValue(true);
		Object.assign(native, { CancelButton: cancel, DeclineButton: cancel });
		s.globals[name] = native;
		s.client.initialize();
		const prompt = s.client
			.getDialogs()
			.find((entry) => entry.id === `native-${name}`);
		expect(prompt).toBeDefined();
		prompt?.cancel();
		expect(s.controls.control).toHaveBeenCalledWith(
			`native-${name}:cancel`,
			cancel,
		);
	},
);
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
		control: vi.fn((id: string) => ({
			navId: id,
			onFocus: vi.fn(),
			onBlur: vi.fn(),
			onInteract: vi.fn(),
		})),
		list: vi.fn(() => [
			[
				{
					navId: "row",
					onFocus: vi.fn(),
					onBlur: vi.fn(),
					onInteract: vi.fn(),
				},
			],
		]),
		click: vi.fn(),
		addMenuAction: vi.fn(),
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
	const additional = {
		initialize: vi.fn(),
		getDialogs: vi.fn((): NativeDialog[] => []),
		shutdown: vi.fn(),
	};
	const client = new NativeDialogsClient(events, controls, scheduler, [
		additional,
	]);
	return {
		globals,
		observers,
		controls,
		hooks,
		client,
		changed,
		additional,
		flush: () => {
			for (const callback of callbacks.splice(0)) callback();
		},
	};
}

it("keeps injected feature dialogs below native prompts and owns their lifecycle", () => {
	const s = setup();
	const popup = dialog();
	popup.IsVisible.mockReturnValue(true);
	s.globals.StaticPopup1 = popup;
	s.additional.getDialogs.mockReturnValue([
		{ id: "native-prey-map", grid: [], cancel: vi.fn() },
		{ id: "native-prey-quest", grid: [], cancel: vi.fn() },
	]);
	s.client.initialize();
	expect(s.additional.initialize).toHaveBeenCalledOnce();
	expect(s.client.getDialogs().map((dialog) => dialog.id)).toEqual([
		"native-prey-map",
		"native-prey-quest",
		"native-StaticPopup1",
	]);
	s.client.shutdown();
	expect(s.additional.shutdown).toHaveBeenCalledOnce();
});
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

it("discovers the late-loaded AddOns manager and exposes its header, logical rows and footer", () => {
	const s = setup();
	s.client.initialize();
	const button = () => ({ IsVisible: () => true, IsEnabled: () => true });
	const addon = {
		...dialog(),
		Dropdown: {
			...button(),
			IsMenuOpen: vi.fn(() => false),
			CloseMenu: vi.fn(),
			menu: {},
		},
		ForceLoad: button(),
		SearchBox: button(),
		EnableAllButton: button(),
		DisableAllButton: button(),
		OkayButton: button(),
		CancelButton: button(),
		ScrollBox: {},
	};
	addon.IsVisible.mockReturnValue(true);
	const cancel = vi.fn();
	Object.assign(s.globals, { AddonList: addon, AddonList_OnCancel: cancel });
	s.hooks.get("ShowUIPanel")?.(addon as unknown as NativeDialogFrame);
	const dialogState = s.client.getDialogs().at(0);
	expect(dialogState?.id).toBe("native-AddonList");
	expect(dialogState?.grid.map((row) => row.map((node) => node.navId))).toEqual(
		[
			[
				"native-AddonList:Dropdown",
				"native-AddonList:ForceLoad",
				"native-AddonList:SearchBox",
			],
			["row"],
			[
				"native-AddonList:EnableAllButton",
				"native-AddonList:DisableAllButton",
				"native-AddonList:OkayButton",
				"native-AddonList:CancelButton",
			],
		],
	);
	expect(s.controls.list).toHaveBeenCalledWith(
		"native-AddonList",
		addon.ScrollBox,
		expect.any(Function),
		expect.any(Function),
	);
	addon.Dropdown.IsMenuOpen.mockReturnValue(true);
	s.client.getDialogs();
	expect(s.controls.grid).toHaveBeenLastCalledWith(
		"native-AddonList:characters",
		addon.Dropdown.menu,
		true,
	);
	expect(s.observers.has(addon.Dropdown.menu as NativeDialogFrame)).toBe(true);
	dialogState?.cancel();
	expect(addon.Dropdown.CloseMenu).toHaveBeenCalledOnce();
	expect(cancel).not.toHaveBeenCalled();
	addon.Dropdown.IsMenuOpen.mockReturnValue(false);
	dialogState?.cancel();
	expect(cancel).toHaveBeenCalledOnce();
	s.client.shutdown();
	s.hooks.get("AddonList_Update")?.(addon as unknown as NativeDialogFrame);
	s.flush();
	expect(s.changed).not.toHaveBeenCalled();
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

it("adds one reload action beside AddOns on each menu rebuild, with a Support fallback", () => {
	const s = setup();
	const menu = dialog();
	Object.assign(s.globals, {
		GameMenuFrame: menu,
		ADDONS: "AddOns",
		GAMEMENU_SUPPORT: "Support",
	});
	const reload = vi.fn();
	vi.stubGlobal("C_UI", { Reload: reload });
	const methods = new Map<string, (...args: unknown[]) => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(
			target: unknown,
			method: unknown,
			callback?: (...args: unknown[]) => void,
		) => {
			if (target === menu && typeof method === "string" && callback)
				methods.set(method, callback);
		},
	);
	s.client.initialize();
	methods.get("AddButton")?.(menu, "AddOns");
	methods.get("AddButton")?.(menu, "Support");
	expect(s.controls.addMenuAction).toHaveBeenCalledExactlyOnceWith(
		menu,
		"Reload UI",
		expect.any(Function),
	);
	const action = s.controls.addMenuAction.mock.calls.at(0)?.at(2) as
		| (() => void)
		| undefined;
	action?.();
	expect(reload).toHaveBeenCalledOnce();
	methods.get("Reset")?.(menu);
	methods.get("AddButton")?.(menu, "Support");
	expect(s.controls.addMenuAction).toHaveBeenCalledTimes(2);
	s.client.shutdown();
	methods.get("Reset")?.(menu);
	methods.get("AddButton")?.(menu, "AddOns");
	expect(s.controls.addMenuAction).toHaveBeenCalledTimes(2);
});
