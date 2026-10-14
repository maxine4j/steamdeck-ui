import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { BuiltInTalents } from "../modules/talents/built-in-talents";

afterEach(() => vi.unstubAllGlobals());
it("shares native suppression across spellbook and talent tabs and releases it for inspection", () => {
	let tab = 3;
	let inspecting = false;
	const hooks = new Map<string, () => void>();
	const frame = {
		IsShown: () => true,
		IsInspecting: () => inspecting,
		GetTab: () => tab,
		talentTabID: 2,
		specTabID: 1,
		spellBookTabID: 3,
		HookScript: vi.fn(),
	};
	vi.stubGlobal("PlayerSpellsFrame", frame);
	vi.stubGlobal(
		"hooksecurefunc",
		(target: unknown, name: unknown, callback?: () => void) => {
			if (target === frame && callback) hooks.set(String(name), callback);
		},
	);
	const events = createTestEventBus();
	const visible = vi.fn();
	events.subscribe("SPELLBOOK_VISIBILITY_CHANGED", visible);
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const native = new BuiltInTalents(frames, events);
	native.disable();
	expect(native.isSpellbookOpen()).toBe(true);
	expect(native.isOpen()).toBe(false);
	expect(frames.suppress).toHaveBeenCalledWith([frame]);
	tab = 2;
	hooks.get("SetTab")?.();
	expect(native.isOpen()).toBe(true);
	expect(native.isSpellbookOpen()).toBe(false);
	vi.stubGlobal("PlayerSpellsUtil", {
		OpenToClassTalentsTab: () => {
			tab = 2;
		},
	});
	native.openFull();
	expect(native.isFullOpen()).toBe(true);
	tab = 3;
	hooks.get("SetTab")?.();
	expect(native.isSpellbookOpen()).toBe(true);
	tab = 3;
	inspecting = true;
	hooks.get("SetInspectUnit")?.();
	expect(native.isSpellbookOpen()).toBe(false);
	expect(frames.restore).toHaveBeenCalled();
	expect(visible).toHaveBeenCalled();
});
