import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NativeDialogFrame } from "./native-dialog-navigation";
import { NativeRowActions } from "./native-row-actions";

vi.mock("./skin", () => ({ applyButtonSkin: vi.fn() }));

it("searches on mouse click and reveals a reusable inset action only during pointer hover", () => {
	const original = vi.fn();
	const scripts = new Map<string, (() => void) | undefined>([
		["OnClick", original],
	]);
	const hooks = new Map<string, () => void>();
	let over = true;
	const row = {
		GetScript: (name: string) => scripts.get(name),
		SetScript: (name: string, callback: () => void) =>
			scripts.set(name, callback),
		HookScript: (name: string, callback: () => void) =>
			hooks.set(name, callback),
		IsMouseOver: () => over,
		IsEnabled: () => true,
		GetFrameLevel: () => 2,
	};
	const buttonScripts = new Map<string, () => void>();
	const button = {
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		SetFrameLevel: vi.fn(),
		RegisterForClicks: vi.fn(),
		SetText: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
		SetNormalFontObject: vi.fn(),
		IsMouseOver: () => false,
		SetScript: (name: string, callback: () => void) =>
			buttonScripts.set(name, callback),
	};
	const pool = { acquire: vi.fn(() => button), release: vi.fn() };
	const actions = new NativeRowActions(pool as unknown as IFramePoolManager);
	const find = vi.fn();
	const create = vi.fn();
	const frame = row as unknown as NativeDialogFrame;
	actions.bind(frame, find, "Start Group", create);
	scripts.get("OnClick")?.();
	expect(find).toHaveBeenCalledOnce();
	expect(original).not.toHaveBeenCalled();
	hooks.get("OnEnter")?.();
	expect(button.Show).toHaveBeenCalledOnce();
	expect(button.SetPoint).toHaveBeenCalledWith("RIGHT", row, "RIGHT", -8, 0);
	expect(button.SetNormalFontObject).toHaveBeenCalledWith(
		"GameFontNormalSmall",
	);
	buttonScripts.get("OnClick")?.();
	expect(create).toHaveBeenCalledOnce();
	over = false;
	hooks.get("OnLeave")?.();
	expect(button.Hide).toHaveBeenCalled();
	button.Show.mockClear();
	hooks.get("OnEnter")?.();
	expect(button.Show).not.toHaveBeenCalled();
	actions.bind(frame, find, "Start Group", create);
	expect(pool.acquire).toHaveBeenCalledOnce();
	actions.release();
	expect(scripts.get("OnClick")).toBe(original);
	expect(button.SetText).toHaveBeenLastCalledWith("");
	expect(pool.release).toHaveBeenCalledWith("Button", button);
	hooks.get("OnEnter")?.();
	expect(button.Show).not.toHaveBeenCalled();
});
