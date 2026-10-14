import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import type { Frame } from "../ui/components/frame";
import type { NativeLayout } from "../ui/components/native-layout";
import type { NativeNavigation } from "../ui/components/native-navigation";
import { TransmogClient } from "./transmog-client";

afterEach(() => vi.unstubAllGlobals());

function setup(loaded = true) {
	const hooks = new Map<string, () => void>();
	const control = (name: string, x: number, y: number, type = "Button") => {
		const scripts = {
			OnClick: vi.fn(),
			OnMouseDown: vi.fn(),
			OnMouseUp: vi.fn(),
			OnEnter: vi.fn(),
			OnLeave: vi.fn(),
		};
		return {
			GetName: () => name,
			GetChildren: () => [],
			GetCenter: () => [x, y],
			GetEffectiveScale: () => 1,
			IsVisible: vi.fn(() => true),
			IsObjectType: (value: string) => value === type,
			IsEnabled: vi.fn(() => true),
			IsProtected: () => false,
			GetScript: (script: keyof typeof scripts) => scripts[script],
			Click: vi.fn(),
			HookScript: vi.fn(),
			scripts,
		};
	};
	const slot = control("slot", 20, 100);
	const model = control("appearance", 80, 100, "DressUpModel");
	const save = control("save", 20, 20);
	const hidden = control("hidden", 40, 50);
	hidden.IsVisible.mockReturnValue(false);
	const disabled = control("disabled", 60, 50);
	disabled.IsEnabled.mockReturnValue(false);
	const region = () => ({ IsShown: () => true, Hide: vi.fn(), Show: vi.fn() });
	const frame = {
		GetSize: () => [1000, 500],
		IsShown: vi.fn(() => true),
		IsVisible: () => true,
		GetChildren: () => [slot, model, save, hidden, disabled],
		HookScript: (script: string, callback: () => void) =>
			hooks.set(script, callback),
		NineSlice: region(),
		PortraitContainer: region(),
		TitleContainer: region(),
		CloseButton: region(),
		HelpPlateButton: region(),
	};
	vi.stubGlobal("TransmogFrame", loaded ? frame : undefined);
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) => {
		const name = typeof args.at(0) === "string" ? args.at(0) : args.at(1);
		hooks.set(String(name), args.at(-1) as () => void);
	});
	vi.stubGlobal(
		"HideUIPanel",
		vi.fn(() => frame.IsShown.mockReturnValue(false)),
	);
	vi.stubGlobal("HelpPlate", { Hide: vi.fn() });
	const events = createTestEventBus();
	const changed = vi.fn();
	const visibility = vi.fn();
	events.subscribe("TRANSMOG_CHANGED", changed);
	events.subscribe("TRANSMOG_VISIBILITY_CHANGED", visibility);
	const layout = { bind: vi.fn(), release: vi.fn() };
	const focus = {
		navigation: vi.fn((_frame, _scroll, navId, onInteract) => ({
			navId,
			onInteract,
			onFocus: vi.fn(),
			onBlur: vi.fn(),
		})),
		release: vi.fn(),
	};
	const chrome = { hide: vi.fn(), restore: vi.fn() };
	const client = new TransmogClient(
		layout as unknown as NativeLayout,
		focus as unknown as NativeNavigation,
		events,
		chrome,
	);
	const parent = { getSize: () => ({ width: 1400, height: 800 }) } as Frame;
	return {
		client,
		parent,
		frame,
		slot,
		model,
		save,
		hooks,
		changed,
		visibility,
		layout,
		focus,
		chrome,
	};
}

it("fits and enlarges the native window, removes requested chrome and restores it on unmount", () => {
	const { client, frame, parent, layout, chrome, focus } = setup();
	client.disable();
	expect(client.presentation({ width: 1400, height: 800 })).toEqual({
		width: 1400,
		height: 700,
	});
	client.mount(parent);
	expect(layout.bind).toHaveBeenCalledWith(
		frame,
		expect.objectContaining({
			parent,
			reparent: true,
			anchors: [["CENTER", "CENTER", 0, 0]],
			size: [1000, 500],
			scale: 1.4,
		}),
	);
	expect(chrome.hide).toHaveBeenCalledWith([
		frame.NineSlice,
		frame.PortraitContainer,
		frame.TitleContainer,
		frame.CloseButton,
		frame.HelpPlateButton,
	]);
	expect(HelpPlate.Hide).toHaveBeenCalledWith(false);
	client.unmount();
	expect(HideUIPanel).toHaveBeenCalledWith(frame);
	expect(layout.release).toHaveBeenCalledOnce();
	expect(chrome.restore).toHaveBeenCalledOnce();
	expect(focus.release).toHaveBeenCalledOnce();
	expect(client.navigation()).toEqual([]);
});

it("navigates visible enabled slots, appearance models and actions with native tooltips and click scripts", () => {
	const { client, parent, slot, model } = setup();
	client.mount(parent);
	const grid = client.navigation();
	expect(grid.map((row) => row.map((node) => node.navId))).toEqual([
		["transmog-slot", "transmog-appearance"],
		["transmog-save"],
	]);
	expect(grid.at(0)?.at(1)?.navColumn).toBe(80);
	grid.at(0)?.at(0)?.onFocus();
	expect(slot.scripts.OnEnter).toHaveBeenCalledWith(slot);
	grid.at(0)?.at(0)?.onInteract();
	expect(slot.Click).toHaveBeenCalledWith("LeftButton");
	grid.at(0)?.at(0)?.onBlur();
	expect(slot.scripts.OnLeave).toHaveBeenCalledWith(slot);
	grid.at(0)?.at(1)?.onInteract();
	expect(model.scripts.OnMouseDown).toHaveBeenCalledWith(model, "LeftButton");
	expect(model.scripts.OnMouseUp).toHaveBeenCalledWith(model, "LeftButton");
});

it("opens native dropdowns, navigates their detached menus, and dismisses them before closing", () => {
	const { client, parent, frame, slot, save } = setup();
	let open = false;
	const menu = {
		...frame,
		GetName: () => "menu",
		IsObjectType: () => false,
		IsProtected: () => false,
		IsVisible: () => open,
		GetChildren: () => [save],
	};
	const dropdown = {
		...slot,
		GetName: () => "filter",
		IsObjectType: (type: string) => type === "DropdownButton",
		OpenMenu: vi.fn(() => {
			open = true;
		}),
		CloseMenu: vi.fn(() => {
			open = false;
		}),
		IsMenuOpen: () => open,
		menu,
	};
	frame.GetChildren = () => [dropdown];
	client.mount(parent);
	client.navigation().at(0)?.at(0)?.onInteract();
	expect(dropdown.OpenMenu).toHaveBeenCalledOnce();
	expect(
		client
			.navigation()
			.flat()
			.map((node) => node.navId),
	).toEqual(["transmog-save"]);
	expect(client.dismissMenus()).toBe(true);
	expect(dropdown.CloseMenu).toHaveBeenCalledOnce();
	expect(client.dismissMenus()).toBe(false);
	dropdown.OpenMenu();
	client.unmount();
	expect(open).toBe(false);
});

it("attaches after lazy loading, publishes visibility and changes, and stops publishing after restore", () => {
	const { client, frame, hooks, visibility, changed, parent } = setup(false);
	client.disable();
	expect(client.isOpen()).toBe(false);
	vi.stubGlobal("TransmogFrame", frame);
	hooks.get("ShowUIPanel")?.();
	expect(client.isOpen()).toBe(true);
	expect(visibility).toHaveBeenCalled();
	client.mount(parent);
	hooks.get("OnEvent")?.();
	expect(changed).toHaveBeenCalled();
	frame.IsShown.mockReturnValue(false);
	hooks.get("OnHide")?.();
	expect(client.isOpen()).toBe(false);
	client.restore();
	visibility.mockClear();
	changed.mockClear();
	hooks.get("OnShow")?.();
	hooks.get("OnEvent")?.();
	expect(visibility).not.toHaveBeenCalled();
	expect(changed).not.toHaveBeenCalled();
});
