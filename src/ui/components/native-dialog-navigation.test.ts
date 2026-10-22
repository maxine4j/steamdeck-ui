import { afterEach, expect, it, vi } from "vitest";
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
		IsObjectType: () => button,
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
