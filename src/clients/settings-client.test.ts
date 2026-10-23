import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { SystemDialogsModule } from "../modules/system-dialogs/system-dialogs-module";
import {
	type NativeDialogFrame,
	NativeDialogNavigation,
} from "../ui/components/native-dialog-navigation";
import { NavigationManager } from "../ui/navigation/navigation-manager";
import { SettingsClient } from "./settings-client";

afterEach(() => vi.unstubAllGlobals());

function frame() {
	return {
		IsVisible: vi.fn(() => true),
		IsEnabled: () => true,
		IsObjectType: (type: string) => type === "Button",
		GetChildren: () => [],
		GetTop: () => 100,
		GetLeft: () => 0,
		HookScript: vi.fn(),
		GetScript: () => undefined,
		Click: vi.fn(),
	};
}
function setup() {
	const events = createTestEventBus();
	const pending: (() => void)[] = [];
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(_frame: unknown, method: string, callback: () => void) =>
			hooks.set(method, callback),
	);
	const category = {
		GetTemplate: () => "SettingsCategoryListButtonTemplate",
		data: { category: { GetID: () => 7 } },
	};
	const header = { GetTemplate: () => "SettingsCategoryListHeaderTemplate" };
	const setting = {
		GetTemplate: () => "SettingsCheckboxSliderControlTemplate",
	};
	const checkbox = frame();
	let value = 20;
	const slider = {
		...frame(),
		IsObjectType: (type: string) => type === "Slider",
		GetValue: () => value,
		GetValueStep: () => 5,
		GetMinMaxValues: () => [0, 100],
		SetValue: (next: number) => {
			value = next;
		},
	};
	const categoryFrame = frame();
	const row = {
		...frame(),
		Checkbox: checkbox,
		SliderWithSteppers: { Slider: slider },
	};
	const scroll = <T>(data: T[], realized: unknown) => ({
		ForEachElementData: (callback: (entry: T) => void) =>
			data.forEach(callback),
		ScrollToElementData: vi.fn(),
		FindFrame: vi.fn(() => realized as NativeDialogFrame),
	});
	const categories = scroll([header, category], categoryFrame);
	const settings = scroll([setting], row);
	const host = {
		...frame(),
		GameTab: frame(),
		AddOnsTab: frame(),
		SearchBox: frame(),
		CloseButton: frame(),
		ApplyButton: frame(),
		CategoryList: { ScrollBox: categories },
		Container: {
			SettingsList: {
				...frame(),
				ScrollBox: settings,
				Header: { DefaultsButton: frame() },
			},
			SettingsCanvas: { ...frame(), IsVisible: () => false },
		},
	};
	const globals: { SettingsPanel?: typeof host } = { SettingsPanel: host };
	vi.stubGlobal("_G", globals);
	const native = {
		navigation: vi.fn((_frame, _scroll, navId, onInteract) => ({
			navId,
			onInteract,
			onFocus: vi.fn(),
			onBlur: vi.fn(),
		})),
		release: vi.fn(),
	};
	const client = new SettingsClient(
		events,
		new NativeDialogNavigation(native),
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return vi.fn();
			},
		},
	);
	return {
		client,
		events,
		host,
		globals,
		categories,
		settings,
		setting,
		row,
		checkbox,
		slider,
		categoryFrame,
		hooks,
		native,
		value: () => value,
		flush: () =>
			pending.splice(0).forEach((callback) => {
				callback();
			}),
	};
}

it("navigates categories and offscreen setting controls, edits sliders both ways, and closes on Back", () => {
	const s = setup();
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	expect(dialog?.id).toBe("native-settings");
	const nodes = dialog?.grid.flat() ?? [];
	const category = nodes.find((node) => node.navId.includes("category:7"));
	expect(category).toBeDefined();
	category?.onFocus();
	category?.onInteract();
	expect(s.categoryFrame.Click).toHaveBeenCalledOnce();
	const checkbox = nodes.find((node) => node.navId.endsWith(":Checkbox"));
	checkbox?.onFocus();
	checkbox?.onInteract();
	expect(s.settings.ScrollToElementData).toHaveBeenCalled();
	expect(s.checkbox.Click).toHaveBeenCalledOnce();
	const slider = nodes.find((node) =>
		node.navId.endsWith(":SliderWithSteppers.Slider"),
	);
	slider?.onFocus();
	slider?.onInteract();
	expect(s.value()).toBe(25);
	slider?.onContext?.();
	expect(s.value()).toBe(20);
	expect(s.categories.ScrollToElementData).toHaveBeenCalledTimes(1);
	dialog?.cancel();
	expect(s.host.CloseButton.Click).toHaveBeenCalledOnce();
	s.host.IsVisible.mockReturnValue(false);
	expect(s.client.getDialogs()).toEqual([]);
	s.client.shutdown();
});

it("discovers Settings after lazy loading, refreshes layout changes and stops on shutdown", () => {
	const s = setup();
	delete s.globals.SettingsPanel;
	s.client.initialize();
	expect(s.client.getDialogs()).toEqual([]);
	s.globals.SettingsPanel = s.host;
	s.events.emit("DIALOGUE_ADDON_LOADED");
	expect(s.client.getDialogs()).toHaveLength(1);
	s.flush();
	const changed = vi.fn();
	s.events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	s.hooks.get("DisplayLayout")?.();
	s.flush();
	expect(changed).toHaveBeenCalledOnce();
	s.client.shutdown();
	s.hooks.get("DisplayLayout")?.();
	s.flush();
	expect(changed).toHaveBeenCalledOnce();
	expect(s.client.getDialogs()).toEqual([]);
	expect(s.native.release).toHaveBeenCalledOnce();
});

it("restricts navigation to an open dropdown and Back closes it before Settings", () => {
	const s = setup();
	let open = false;
	const choice = frame();
	const menu = {
		...frame(),
		IsVisible: () => open,
		GetChildren: () => [choice],
	};
	const dropdown = {
		...frame(),
		menu,
		OpenMenu: () => {
			open = true;
		},
		CloseMenu: vi.fn(() => {
			open = false;
		}),
		IsMenuOpen: () => open,
	};
	Object.assign(s.setting, {
		GetTemplate: () => "SettingsDropdownControlTemplate",
	});
	Object.assign(s.row, { Control: { Dropdown: dropdown } });
	s.client.initialize();
	s.client
		.getDialogs()
		.at(0)
		?.grid.flat()
		.find((node) => node.navId.endsWith(":Control.Dropdown"))
		?.onInteract();
	expect(open).toBe(true);
	let dialog = s.client.getDialogs().at(0);
	expect(dialog?.grid.flat()).toHaveLength(1);
	dialog?.grid.at(0)?.at(0)?.onInteract();
	expect(choice.Click).toHaveBeenCalledOnce();
	dialog?.cancel();
	expect(dropdown.CloseMenu).toHaveBeenCalledOnce();
	expect(s.host.CloseButton.Click).not.toHaveBeenCalled();
	dialog = s.client.getDialogs().at(0);
	expect(
		dialog?.grid.flat().some((node) => node.navId === "settings:close"),
	).toBe(true);
	s.client.shutdown();
});

it("skips disabled controls while retaining logical rows that have not been realized", () => {
	const s = setup();
	Object.assign(s.checkbox, { IsEnabled: () => false });
	s.client.initialize();
	expect(
		s.client
			.getDialogs()
			.at(0)
			?.grid.flat()
			.some((node) => node.navId.endsWith(":Checkbox")),
	).toBe(false);
	s.settings.FindFrame.mockReturnValue(
		undefined as unknown as NativeDialogFrame,
	);
	expect(
		s.client
			.getDialogs()
			.at(0)
			?.grid.flat()
			.some((node) => node.navId.endsWith(":Checkbox")),
	).toBe(true);
	s.client.shutdown();
});

it("keeps custom canvas controls to the right of the category list", () => {
	const s = setup();
	const button = frame();
	s.host.Container.SettingsList.IsVisible.mockReturnValue(false);
	Object.assign(s.host.Container.SettingsCanvas, {
		IsVisible: () => true,
		IsObjectType: () => false,
		GetChildren: () => [button],
	});
	s.client.initialize();
	const node = s.client
		.getDialogs()
		.at(0)
		?.grid.flat()
		.find((node) => node.navId.startsWith("settings:canvas"));
	expect(node?.navColumn).toBe(1);
	node?.onInteract();
	expect(button.Click).toHaveBeenCalledOnce();
	s.client.shutdown();
});

it("routes D-pad input from categories through setting controls and preserves focus after editing", () => {
	const s = setup();
	const navigation = new NavigationManager(s.events);
	const dialogs = new SystemDialogsModule(s.client, s.events, navigation);
	dialogs.initialize();
	s.events.emit("NAV_DOWN");
	expect(navigation.focusedId).toBe("settings:category:7");
	s.events.emit("NAV_RIGHT");
	expect(navigation.focusedId).toContain(":Checkbox");
	s.events.emit("NAV_RIGHT");
	expect(navigation.focusedId).toContain(":SliderWithSteppers.Slider");
	const focused = navigation.focusedId;
	s.events.emit("NAV_INTERACT");
	s.flush();
	expect(s.value()).toBe(25);
	expect(navigation.focusedId).toBe(focused);
	s.events.emit("NAV_CANCEL");
	expect(s.host.CloseButton.Click).toHaveBeenCalledOnce();
	dialogs.shutdown();
	navigation.destroy();
});
