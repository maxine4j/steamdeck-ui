import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInTalents } from "./built-in-talents";

afterEach(() => vi.unstubAllGlobals());
it("loads lazily, replaces only player talent/spec tabs and restores the full editor on request", () => {
	const hooks = new Map<string, () => void>();
	let shown = false;
	let tab = 2;
	let inspecting = false;
	let suppressed = false;
	const nativeTreeShow = vi.fn();
	const frame = {
		IsShown: () => shown,
		IsInspecting: () => inspecting,
		GetTab: () => tab,
		specTabID: 1,
		talentTabID: 2,
		HookScript: (script: string, callback: () => void) =>
			hooks.set(script, callback),
	};
	vi.stubGlobal("PlayerSpellsFrame", undefined);
	const load = vi.fn(() => {
		vi.stubGlobal("PlayerSpellsFrame", frame);
		hooks.get("load")?.();
	});
	vi.stubGlobal("PlayerSpellsFrame_LoadUI", load);
	vi.stubGlobal(
		"hooksecurefunc",
		(target: unknown, name: unknown, callback?: () => void) => {
			if (target === "PlayerSpellsFrame_LoadUI")
				hooks.set("load", name as () => void);
			else if (typeof target === "string")
				hooks.set(target, name as () => void);
			else if (callback) hooks.set(String(name), callback);
		},
	);
	vi.stubGlobal("PlayerSpellsUtil", {
		OpenToClassTalentsTab: () => {
			if (!PlayerSpellsFrame) load();
			tab = 2;
			hooks.get("SetTab")?.();
			shown = true;
			if (!suppressed) {
				nativeTreeShow();
				hooks.get("OnShow")?.();
			}
			hooks.get("ShowUIPanel")?.();
		},
		OpenToClassSpecializationsTab: vi.fn(),
	});
	vi.stubGlobal("HideUIPanel", () => {
		shown = false;
		if (!suppressed) hooks.get("OnHide")?.();
		hooks.get("HideUIPanel")?.();
	});
	const frames = {
		suppress: vi.fn(() => {
			suppressed = true;
		}),
		restore: vi.fn(() => {
			suppressed = false;
		}),
	};
	const events = createTestEventBus();
	const native = new BuiltInTalents(frames, events);
	native.disable();
	expect(load).not.toHaveBeenCalled();
	native.open();
	expect(frames.suppress).toHaveBeenCalledWith([frame]);
	expect(native.isOpen()).toBe(true);
	expect(nativeTreeShow).not.toHaveBeenCalled();
	tab = 3;
	hooks.get("SetTab")?.();
	expect(native.isOpen()).toBe(false);
	expect(frames.restore).toHaveBeenCalled();
	tab = 2;
	inspecting = true;
	hooks.get("SetTab")?.();
	expect(native.isOpen()).toBe(false);
	inspecting = false;
	hooks.get("SetTab")?.();
	native.openFull();
	expect(nativeTreeShow).toHaveBeenCalledOnce();
	expect(native.isOpen()).toBe(false);
	expect(frames.restore).toHaveBeenCalled();
	native.close();
	native.open();
	expect(native.isOpen()).toBe(true);
	expect(nativeTreeShow).toHaveBeenCalledOnce();
	expect(load).toHaveBeenCalledOnce();
	native.restore();
	expect(native.isOpen()).toBe(false);
});
