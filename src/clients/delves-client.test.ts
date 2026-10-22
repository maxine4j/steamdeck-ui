import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { NativeDialogNavigation } from "../ui/components/native-dialog-navigation";
import { DelvesClient } from "./delves-client";

afterEach(() => vi.unstubAllGlobals());

function frame(button = true, children: unknown[] = []) {
	const scripts = new Map<string, (frame: unknown) => void>();
	return {
		IsVisible: vi.fn(() => true),
		IsEnabled: vi.fn(() => true),
		IsObjectType: (type: string) => button && type === "Button",
		GetTop: () => 100,
		GetLeft: () => 0,
		GetChildren: () => children,
		Click: vi.fn(),
		Hide: vi.fn(),
		HookScript: vi.fn(),
		GetScript: (name: string) => scripts.get(name),
		scripts,
	};
}
function setup() {
	const hooks = new Map<unknown, Map<string, () => void>>();
	vi.stubGlobal(
		"hooksecurefunc",
		(target: unknown, method: string, callback: () => void) => {
			if (!hooks.has(target)) hooks.set(target, new Map());
			hooks.get(target)?.set(method, callback);
		},
	);
	let acquire: ((menu: unknown) => void) | undefined;
	let release: ((menu: unknown) => void) | undefined;
	const description = {
		AddMenuAcquiredCallback: (callback: typeof acquire) => {
			acquire = callback;
		},
		AddMenuReleasedCallback: (callback: typeof release) => {
			release = callback;
		},
	};
	const dropdown = {
		...frame(),
		OpenMenu: vi.fn(),
		CloseMenu: vi.fn(),
		GetMenuDescription: () => description,
	};
	const enter = frame();
	const close = frame();
	const difficulty = {
		...frame(false, [dropdown, enter, close]),
		Dropdown: dropdown,
		CloseButton: close,
	};
	const option = frame();
	const list = {
		...frame(false),
		ScrollBox: {
			...frame(false),
			ForEachElementData: (callback: (data: { entryID: number }) => void) =>
				callback({ entryID: 44 }),
			ScrollToElementData: vi.fn(),
			FindFrame: () => option,
		},
	};
	list.IsVisible.mockReturnValue(false);
	const slot = { ...frame(), OptionsList: list };
	const down = vi.fn(() => list.IsVisible.mockReturnValue(true));
	slot.scripts.set("OnMouseDown", down);
	const config = {
		...frame(false, [slot, close]),
		CloseButton: close,
		CompanionSlots: { CompanionCombatRoleSlot: slot },
		CompanionConfigShowAbilitiesButton: enter,
	};
	config.IsVisible.mockReturnValue(false);
	const abilityEnter = vi.fn();
	const abilityLeave = vi.fn();
	const ability = {
		...frame(false),
		nodeID: 33,
		index: 1,
		OnEnter: abilityEnter,
		OnLeave: abilityLeave,
	};
	const abilities = {
		...frame(false, [dropdown, close]),
		CloseButton: close,
		DelvesCompanionRoleDropdown: dropdown,
		buttons: [ability],
	};
	abilities.IsVisible.mockReturnValue(false);
	const globals: Record<string, unknown> = {
		DelvesDifficultyPickerFrame: difficulty,
		DelvesCompanionConfigurationFrame: config,
		DelvesCompanionAbilityListFrame: abilities,
	};
	vi.stubGlobal("_G", globals);
	const navigation = {
		navigation: vi.fn((_frame, _scroll, navId, onInteract, hover) => ({
			navId,
			onInteract,
			onFocus: () => hover?.enter(),
			onBlur: () => hover?.leave(),
		})),
	};
	const controls = new NativeDialogNavigation({
		...navigation,
		release: vi.fn(),
	});
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("NATIVE_DIALOGS_CHANGED", changed);
	const pending: (() => void)[] = [];
	const client = new DelvesClient(events, navigation, controls, {
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	return {
		client,
		difficulty,
		config,
		abilities,
		dropdown,
		slot,
		list,
		option,
		down,
		close,
		enter,
		hooks,
		events,
		globals,
		changed,
		controls,
		abilityEnter,
		abilityLeave,
		acquire: (menu: unknown) => acquire?.(menu),
		release: (menu: unknown) => release?.(menu),
		flush: () => {
			for (const callback of pending.splice(0)) callback();
		},
	};
}

it("navigates difficulty controls and excludes disabled entry actions", () => {
	const s = setup();
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	expect(dialog?.id).toBe("native-delve-difficulty");
	dialog?.grid.flat().at(0)?.onInteract();
	expect(s.dropdown.OpenMenu).toHaveBeenCalledOnce();
	s.enter.IsEnabled.mockReturnValue(false);
	expect(s.client.getDialogs().at(0)?.grid.flat()).toHaveLength(2);
	dialog?.cancel();
	expect(s.close.Click).toHaveBeenCalledWith("LeftButton");
});

it("navigates detached tier submenus and backs out one menu at a time", () => {
	const s = setup();
	s.client.initialize();
	const item = frame();
	const root = { ...frame(false, [item]), Close: vi.fn() };
	const sub = { ...frame(false, [item]), Close: vi.fn() };
	s.acquire(root);
	s.acquire(sub);
	s.client.getDialogs().at(0)?.grid.flat().at(0)?.onInteract();
	expect(item.Click).toHaveBeenCalledOnce();
	s.client.getDialogs().at(0)?.cancel();
	expect(sub.Close).toHaveBeenCalledOnce();
	expect(s.close.Click).not.toHaveBeenCalled();
	sub.IsVisible.mockReturnValue(false);
	s.client.getDialogs().at(0)?.cancel();
	expect(s.dropdown.CloseMenu).toHaveBeenCalledOnce();
});

it("forgets released menus before their pooled frames are reused by another dropdown", () => {
	const s = setup();
	s.client.initialize();
	const item = frame();
	const menu = { ...frame(false, [item]), Close: vi.fn() };
	s.acquire(menu);
	s.release(menu);
	// The pooled menu is now visible for a different owner.
	const dialog = s.client.getDialogs().at(0);
	dialog?.grid.flat().at(0)?.onInteract();
	expect(s.dropdown.OpenMenu).toHaveBeenCalledOnce();
	expect(item.Click).not.toHaveBeenCalled();
	dialog?.cancel();
	expect(s.close.Click).toHaveBeenCalledOnce();
	expect(menu.Close).not.toHaveBeenCalled();
});

it("opens companion slots through mouse-down and navigates logical curio rows with native selection", () => {
	const s = setup();
	s.difficulty.IsVisible.mockReturnValue(false);
	s.config.IsVisible.mockReturnValue(true);
	s.client.initialize();
	const dialog = s.client.getDialogs().at(0);
	expect(dialog?.id).toBe("native-delve-companion");
	dialog?.grid.flat().at(0)?.onInteract();
	expect(s.down).toHaveBeenCalledOnce();
	const options = s.client.getDialogs().at(0);
	expect(options?.grid.flat().at(0)?.navId).toContain("44");
	options?.grid.flat().at(0)?.onFocus();
	options?.grid.flat().at(0)?.onInteract();
	expect(s.option.Click).toHaveBeenCalledWith("LeftButton");
	options?.cancel();
	expect(s.list.Hide).toHaveBeenCalledOnce();
	expect(s.close.Click).not.toHaveBeenCalled();
});

it("refreshes companion navigation when a slot becomes disabled and gates native hooks after shutdown", () => {
	const s = setup();
	s.client.initialize();
	s.flush();
	s.changed.mockClear();
	s.slot.IsEnabled.mockReturnValue(false);
	s.hooks.get(s.slot)?.get("SetEnabled")?.();
	s.flush();
	expect(s.changed).toHaveBeenCalledOnce();
	s.client.shutdown();
	s.changed.mockClear();
	s.hooks.get(s.slot)?.get("SetEnabled")?.();
	s.hooks.get(s.difficulty)?.get("UpdatePortalButtonState")?.();
	s.flush();
	expect(s.changed).not.toHaveBeenCalled();
});

it("exposes companion ability inspection, detects late loads and stops observation on shutdown", () => {
	const s = setup();
	s.difficulty.IsVisible.mockReturnValue(false);
	s.abilities.IsVisible.mockReturnValue(true);
	const host = s.globals.DelvesCompanionAbilityListFrame;
	delete s.globals.DelvesCompanionAbilityListFrame;
	s.client.initialize();
	expect(s.client.getDialogs()).toEqual([]);
	s.globals.DelvesCompanionAbilityListFrame = host;
	s.events.emit("DIALOGUE_ADDON_LOADED");
	const ability = s.client
		.getDialogs()
		.at(0)
		?.grid.flat()
		.find((node) => node.navId === "delve:ability:33");
	expect(ability).toBeDefined();
	ability?.onFocus();
	ability?.onInteract();
	ability?.onBlur();
	expect(s.abilityEnter).toHaveBeenCalledOnce();
	expect(s.abilityLeave).toHaveBeenCalledOnce();
	s.flush();
	s.changed.mockClear();
	s.client.shutdown();
	s.events.emit("DIALOGUE_ADDON_LOADED");
	s.flush();
	expect(s.changed).not.toHaveBeenCalled();
	expect(s.client.getDialogs()).toEqual([]);
});
