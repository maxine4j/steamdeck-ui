import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { CharacterFrameClient } from "./character-frame-client";

afterEach(() => vi.unstubAllGlobals());
it("owns suppression once, ignores nested native hooks and keeps replacement tab switches hidden", () => {
	let shown = true;
	const frame = { IsShown: () => shown, activeSubframe: "TokenFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const fire = () => {
		for (const hook of hooks) hook();
	};
	// Native reparenting invokes child OnHide, which calls hooked HideUIPanel.
	const suppression = { suppress: vi.fn(fire), restore: vi.fn(fire) };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("CURRENCY_VISIBILITY_CHANGED", changed);
	const client = new CharacterFrameClient(suppression, events);
	client.enable("PaperDollFrame", "CHARACTER_VISIBILITY_CHANGED");
	client.enable("ReputationFrame", "REPUTATION_VISIBILITY_CHANGED");
	client.enable("TokenFrame", "CURRENCY_VISIBILITY_CHANGED");
	expect(hooks).toHaveLength(7);
	expect(suppression.suppress).toHaveBeenCalledOnce();
	expect(suppression.restore).not.toHaveBeenCalled();
	changed.mockClear();
	fire();
	fire();
	expect(changed).not.toHaveBeenCalled();
	frame.activeSubframe = "ReputationFrame";
	fire();
	expect(suppression.suppress).toHaveBeenCalledOnce();
	expect(suppression.restore).not.toHaveBeenCalled();
	expect(changed).toHaveBeenCalledOnce();
	shown = false;
	fire();
	expect(suppression.restore).toHaveBeenCalledOnce();
	client.disable("PaperDollFrame");
	client.disable("ReputationFrame");
	client.disable("TokenFrame");
	const calls = changed.mock.calls.length;
	fire();
	expect(changed).toHaveBeenCalledTimes(calls);
});

it("restores unsupported tabs once and keeps active tabs suppressed when other modules stop", () => {
	const frame = { IsShown: () => true, activeSubframe: "PaperDollFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const client = new CharacterFrameClient(suppression, createTestEventBus());
	client.enable("PaperDollFrame", "CHARACTER_VISIBILITY_CHANGED");
	client.enable("TokenFrame", "CURRENCY_VISIBILITY_CHANGED");
	client.disable("TokenFrame");
	expect(suppression.restore).not.toHaveBeenCalled();
	frame.activeSubframe = "OtherAddonTab";
	for (const hook of hooks) hook();
	expect(suppression.restore).toHaveBeenCalledOnce();
	for (const hook of hooks) hook();
	expect(suppression.restore).toHaveBeenCalledOnce();
	frame.activeSubframe = "PaperDollFrame";
	for (const hook of hooks) hook();
	expect(suppression.suppress).toHaveBeenCalledTimes(2);
	client.disable("PaperDollFrame");
	expect(suppression.restore).toHaveBeenCalledTimes(2);
});
