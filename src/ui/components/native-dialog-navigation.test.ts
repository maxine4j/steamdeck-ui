import { afterEach, expect, it, vi } from "vitest";
import type { Frame } from "./frame";
import {
	type NativeDialogFrame,
	NativeDialogNavigation,
} from "./native-dialog-navigation";

afterEach(() => vi.unstubAllGlobals());

function frame(
	button = false,
	x = 0,
	y = 100,
	children: NativeDialogFrame[] = [],
) {
	const scripts = new Map<string, () => void>();
	return {
		GetChildren: () => children,
		IsVisible: vi.fn(() => true),
		IsObjectType: (type: string) => button && type === "Button",
		IsEnabled: vi.fn(() => true),
		GetTop: () => y,
		GetLeft: () => x,
		Click: vi.fn(),
		HookScript: (script: string, callback: () => void) =>
			scripts.set(script, callback),
		GetScript: () => undefined,
		scripts,
	};
}

function setup() {
	const native = {
		navigation: vi.fn((_frame, _scroll, navId, onInteract, hover) => ({
			navId,
			onInteract,
			onFocus: () => hover?.enter(),
			onBlur: () => hover?.leave(),
		})),
		release: vi.fn(),
	};
	vi.stubGlobal("hooksecurefunc", vi.fn());
	return { native, adapter: new NativeDialogNavigation(native) };
}

it("reports the logical node for each discovered enabled control", () => {
	const { adapter } = setup();
	const enabled = frame(true),
		disabled = frame(true);
	disabled.IsEnabled.mockReturnValue(false);
	const root = frame(false, 0, 0, [
		enabled,
		disabled,
	] as unknown as NativeDialogFrame[]);
	const discovered = vi.fn();
	const grid = adapter.grid(
		"menu",
		root as unknown as NativeDialogFrame,
		true,
		discovered,
	);
	expect(discovered).toHaveBeenCalledExactlyOnceWith(
		enabled,
		grid.at(0)?.at(0),
	);
});

it("activates mouse-down controls only while visible and enabled and dismisses flyouts", () => {
	const { adapter } = setup();
	const down = vi.fn();
	const native = {
		...frame(true),
		GetScript: (script: string) =>
			script === "OnMouseDown" ? down : undefined,
		Hide: vi.fn(),
	};
	const target = native as unknown as NativeDialogFrame;
	adapter.press(target);
	expect(down).toHaveBeenCalledWith(native);
	expect(native.Click).not.toHaveBeenCalled();
	native.IsEnabled.mockReturnValue(false);
	adapter.press(target);
	native.IsEnabled.mockReturnValue(true);
	native.IsVisible.mockReturnValue(false);
	adapter.press(target);
	expect(down).toHaveBeenCalledOnce();
	adapter.hide(target);
	expect(native.Hide).toHaveBeenCalledOnce();
});

it("routes protected menu actions to hardware bindings without synthesizing native clicks", () => {
	const { adapter } = setup();
	const button = frame(true) as unknown as NativeDialogFrame;
	const secure = {} as Frame;
	adapter.bindSecureAction(button, secure);
	const node = adapter.control("focus", button);
	node.onInteract();
	expect(button.Click).not.toHaveBeenCalled();
	expect(node.secureActions?.()).toEqual({ interact: secure });
	adapter.bindSecureAction(button, undefined);
	const blocked = adapter.control("focus", button);
	blocked.onInteract();
	expect(button.Click).not.toHaveBeenCalled();
	expect(blocked.secureActions?.().interact).toBeUndefined();
	adapter.clearSecureAction(button);
	const reused = adapter.control("loot-spec", button);
	reused.onInteract();
	expect(button.Click).toHaveBeenCalledOnce();
	expect(reused.secureActions).toBeUndefined();
});

it("includes native sliders and adjusts them with select/context while clamping their range", () => {
	const { adapter } = setup();
	let value = 50;
	const slider = {
		...frame(),
		IsObjectType: (type: string) => type === "Slider",
		GetValue: () => value,
		GetValueStep: () => 10,
		GetMinMaxValues: () => [0, 100],
		SetValue: vi.fn((next: number) => {
			value = next;
		}),
	};
	const root = frame(false, 0, 0, [slider] as unknown as NativeDialogFrame[]);
	const node = adapter
		.grid("volume", root as unknown as NativeDialogFrame)
		.at(0)
		?.at(0);
	expect(node).toBeDefined();
	node?.onInteract();
	expect(value).toBe(60);
	node?.onContext?.();
	expect(value).toBe(50);
	value = 100;
	node?.onInteract();
	expect(value).toBe(100);
	slider.IsEnabled.mockReturnValue(false);
	node?.onContext?.();
	expect(value).toBe(100);
});

it("adjusts recycled sliders in virtual lists with select and context", () => {
	const { adapter } = setup();
	let value = 50;
	const slider = {
		...frame(),
		IsObjectType: (type: string) => type === "Slider",
		GetValue: () => value,
		GetValueStep: () => 10,
		GetMinMaxValues: () => [0, 100],
		SetValue: (next: number) => {
			value = next;
		},
	};
	const node = adapter
		.list(
			"volume",
			{
				ForEachElementData: (callback) => callback("volume"),
				ScrollToElementData: vi.fn(),
				FindFrame: () => slider as unknown as NativeDialogFrame,
			},
			(id) => id,
		)
		.at(0)
		?.at(0);
	node?.onInteract();
	expect(value).toBe(60);
	node?.onContext?.();
	expect(value).toBe(50);
});

it("does not observe focus decorations attached beneath native buttons", () => {
	const { adapter } = setup();
	const decoration = frame();
	const button = frame(true, 0, 0, [
		decoration,
	] as unknown as NativeDialogFrame[]);
	const root = frame(false, 0, 0, [button] as unknown as NativeDialogFrame[]);
	const changed = vi.fn();
	adapter.watch(root as unknown as NativeDialogFrame, changed);
	adapter.grid("popup", root as unknown as NativeDialogFrame);
	decoration.scripts.get("OnShow")?.();
	expect(changed).not.toHaveBeenCalled();
});

it("makes added native menu actions controller accessible and restores the host menu on release", () => {
	const { adapter } = setup();
	const children: NativeDialogFrame[] = [];
	const action = vi.fn();
	const menu = {
		...frame(false, 0, 0, children),
		AddButton: vi.fn((_label: string, callback: () => void) => {
			children.push({
				...frame(true),
				Click: callback,
			} as unknown as NativeDialogFrame);
		}),
		InitButtons: vi.fn(() => {
			children.splice(0);
		}),
	};
	adapter.addMenuAction(menu as unknown as NativeDialogFrame, "Action", action);
	expect(menu.AddButton).toHaveBeenCalledWith("Action", action);
	adapter
		.grid("menu", menu as unknown as NativeDialogFrame, true)
		.at(0)
		?.at(0)
		?.onInteract();
	expect(action).toHaveBeenCalledOnce();
	adapter.release();
	expect(menu.InitButtons).toHaveBeenCalledOnce();
	expect(
		adapter.grid("menu", menu as unknown as NativeDialogFrame, true),
	).toEqual([]);
});

it("builds a vertical menu and preserves native hover scripts", () => {
	const { adapter } = setup();
	const top = frame(true, 0, 100),
		bottom = frame(true, 0, 20);
	const enter = vi.fn(),
		leave = vi.fn();
	top.GetScript = (script: string) => (script === "OnEnter" ? enter : leave);
	const root = frame(false, 0, 0, [
		bottom,
		top,
	] as unknown as NativeDialogFrame[]);
	const grid = adapter.grid("menu", root as unknown as NativeDialogFrame, true);
	expect(grid.map((row) => row.length)).toEqual([1, 1]);
	grid.at(0)?.at(0)?.onFocus();
	expect(enter).toHaveBeenCalledWith(top);
	grid.at(0)?.at(0)?.onBlur();
	expect(leave).toHaveBeenCalledWith(top);
	grid.at(1)?.at(0)?.onInteract();
	expect(bottom.Click).toHaveBeenCalledOnce();
});

it("navigates visible enabled nested buttons in rows and invokes native clicks", () => {
	const { adapter } = setup();
	const first = frame(true, 0, 20),
		second = frame(true, 100, 20);
	const hidden = frame(true),
		disabled = frame(true);
	hidden.IsVisible.mockReturnValue(false);
	disabled.IsEnabled.mockReturnValue(false);
	const root = frame(false, 0, 0, [
		second,
		frame(false, 0, 0, [first]),
		hidden,
		disabled,
	] as unknown as NativeDialogFrame[]);
	const grid = adapter.grid("popup", root as unknown as NativeDialogFrame);
	expect(grid.map((row) => row.length)).toEqual([2]);
	grid.at(0)?.at(0)?.onInteract();
	expect(first.Click).toHaveBeenCalledOnce();
	first.IsEnabled.mockReturnValue(false);
	grid.at(0)?.at(0)?.onInteract();
	expect(first.Click).toHaveBeenCalledOnce();
	expect(
		adapter
			.grid("popup", root as unknown as NativeDialogFrame)
			.at(0)
			?.at(0)?.navId,
	).toBe(grid.at(0)?.at(1)?.navId);
});

it("observes visibility and enabled changes, discovers new controls and stops after release", () => {
	const { adapter, native } = setup();
	const children: NativeDialogFrame[] = [];
	const root = frame(false, 0, 0, children);
	const changed = vi.fn();
	adapter.watch(root as unknown as NativeDialogFrame, changed);
	root.scripts.get("OnShow")?.();
	expect(changed).toHaveBeenCalledOnce();
	const button = frame(true);
	children.push(button as unknown as NativeDialogFrame);
	adapter.grid("menu", root as unknown as NativeDialogFrame, true);
	button.scripts.get("OnHide")?.();
	expect(changed).toHaveBeenCalledTimes(2);
	const hooks = vi.mocked(hooksecurefunc).mock.calls as unknown as [
		unknown,
		string,
		() => void,
	][];
	hooks
		.find((call) => call.at(0) === button && call.at(1) === "SetEnabled")
		?.at(2)?.();
	expect(changed).toHaveBeenCalledTimes(3);
	adapter.release();
	root.scripts.get("OnShow")?.();
	expect(changed).toHaveBeenCalledTimes(3);
	expect(native.release).toHaveBeenCalledOnce();
});

it("reveals virtual rows before focusing and resolves recycled controls on interaction", () => {
	const { adapter, native } = setup();
	const data = [{ id: "first" }, { id: "offscreen" }];
	let current = frame(true);
	const scroll = {
		ForEachElementData: (callback: (data: { id: string }) => void) =>
			data.forEach(callback),
		ScrollToElementData: vi.fn(),
		FindFrame: vi.fn(() => current as unknown as NativeDialogFrame),
	};
	const grid = adapter.list("list", scroll, (item) => item.id);
	expect(grid).toHaveLength(2);
	expect(scroll.ScrollToElementData).not.toHaveBeenCalled();
	const node = grid.at(1)?.at(0);
	node?.onFocus();
	expect(scroll.ScrollToElementData).toHaveBeenCalledWith(
		data.at(1),
		0.5,
		0,
		true,
	);
	expect(native.navigation).toHaveBeenLastCalledWith(
		current,
		undefined,
		"list:offscreen",
		expect.any(Function),
		expect.any(Object),
	);
	scroll.ScrollToElementData.mockClear();
	node?.onFocus(true);
	expect(scroll.ScrollToElementData).not.toHaveBeenCalled();
	current = frame(true);
	node?.onInteract();
	expect(current.Click).toHaveBeenCalledWith("LeftButton");
	node?.onBlur();
});

it("activates dropdowns and edit boxes through their native APIs", () => {
	const { adapter } = setup();
	const dropdown = {
		...frame(true),
		IsObjectType: (type: string) => type === "DropdownButton",
		OpenMenu: vi.fn(),
	};
	const edit = {
		...frame(),
		IsObjectType: (type: string) => type === "EditBox",
		SetFocus: vi.fn(),
	};
	const root = frame(false, 0, 0, [
		dropdown,
		edit,
	] as unknown as NativeDialogFrame[]);
	const grid = adapter.grid("dialog", root as unknown as NativeDialogFrame);
	expect(grid.at(0)).toHaveLength(2);
	grid.at(0)?.at(0)?.onInteract();
	grid.at(0)?.at(1)?.onInteract();
	expect(dropdown.OpenMenu).toHaveBeenCalledOnce();
	expect(edit.SetFocus).toHaveBeenCalledOnce();
});

it("resolves a virtual row's primary action against its recycled child", () => {
	const { adapter } = setup();
	let invite = frame(true);
	const scroll = {
		ForEachElementData: (callback: (data: string) => void) =>
			callback("applicant"),
		ScrollToElementData: vi.fn(),
		FindFrame: () => frame(true) as unknown as NativeDialogFrame,
	};
	const node = adapter
		.list(
			"applicants",
			scroll,
			(id) => id,
			undefined,
			() => invite as unknown as NativeDialogFrame,
		)
		.at(0)
		?.at(0);
	node?.onInteract();
	expect(invite.Click).toHaveBeenCalledOnce();
	invite = frame(true);
	node?.onInteract();
	expect(invite.Click).toHaveBeenCalledOnce();
});

it("routes a logical row's context action to its current visible child control", () => {
	const { adapter } = setup();
	const load = frame(true);
	const row = { ...frame(true), load };
	const scroll = {
		ForEachElementData: (callback: (data: string) => void) => callback("addon"),
		ScrollToElementData: vi.fn(),
		FindFrame: () => row as unknown as NativeDialogFrame,
	};
	const node = adapter
		.list(
			"list",
			scroll,
			(data) => data,
			() => load as unknown as NativeDialogFrame,
		)
		.at(0)
		?.at(0);
	node?.onContext?.();
	expect(load.Click).toHaveBeenCalledWith("LeftButton");
	expect(row.Click).not.toHaveBeenCalled();
	load.IsVisible.mockReturnValue(false);
	node?.onContext?.();
	expect(load.Click).toHaveBeenCalledOnce();
});

it("notifies when a watched dropdown opens so detached menu buttons can take focus", () => {
	const { adapter } = setup();
	const dropdown = { ...frame(), OpenMenu: vi.fn(), CloseMenu: vi.fn() };
	const changed = vi.fn();
	adapter.watch(dropdown as unknown as NativeDialogFrame, changed);
	const hooks = vi.mocked(hooksecurefunc).mock.calls as unknown as [
		unknown,
		string,
		() => void,
	][];
	hooks
		.find((call) => call.at(0) === dropdown && call.at(1) === "OpenMenu")
		?.at(2)?.();
	expect(changed).toHaveBeenCalledOnce();
});

it("reveals a scrollable native menu's actual button before interacting", () => {
	const { adapter } = setup();
	const button = frame(true);
	button.IsVisible.mockReturnValue(false);
	const scroll = {
		...frame(),
		ForEachElementData: (callback: (data: NativeDialogFrame) => void) =>
			callback(button as unknown as NativeDialogFrame),
		ScrollToElementData: vi.fn(() => button.IsVisible.mockReturnValue(true)),
	};
	const menu = { ...frame(), ScrollBox: scroll };
	const node = adapter
		.menu(
			"menu",
			menu as unknown as import("./native-dialog-navigation").NativeDialogMenu,
		)
		.at(0)
		?.at(0);
	node?.onFocus();
	node?.onInteract();
	expect(scroll.ScrollToElementData).toHaveBeenCalledWith(button, 0.5, 0, true);
	expect(button.Click).toHaveBeenCalledWith("LeftButton");
});

it("includes nested edit fields in a scrollable native filter template", () => {
	const { adapter } = setup();
	const edit = {
		...frame(),
		IsObjectType: (type: string) => type === "EditBox",
		SetFocus: vi.fn(),
	};
	const template = frame(false, 0, 100, [edit as unknown as NativeDialogFrame]);
	const scroll = {
		...frame(),
		ForEachElementData: (callback: (data: NativeDialogFrame) => void) =>
			callback(template as unknown as NativeDialogFrame),
		ScrollToElementData: vi.fn(),
	};
	const node = adapter
		.menu("filters", {
			...frame(),
			ScrollBox: scroll,
		} as unknown as import("./native-dialog-navigation").NativeDialogMenu)
		.at(0)
		?.at(0);
	node?.onInteract();
	expect(edit.SetFocus).toHaveBeenCalledOnce();
});

it("opens a native menu description's submenu when controller input selects it", () => {
	const { adapter } = setup();
	const open = vi.fn();
	const button = {
		...frame(true),
		GetElementDescription: () => ({
			CanOpenSubmenu: () => true,
			ForceOpenSubmenu: open,
		}),
	};
	adapter
		.control("submenu", button as unknown as NativeDialogFrame)
		.onInteract();
	expect(open).toHaveBeenCalledOnce();
	expect(button.Click).not.toHaveBeenCalled();
});
