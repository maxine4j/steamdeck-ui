import { afterEach, expect, it, vi } from "vitest";
import { CharacterFrameClient } from "../../clients/character-frame-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInPaperDoll } from "../paper-doll/built-in-paper-doll";
import { BuiltInReputation } from "./built-in-reputation";

afterEach(() => vi.unstubAllGlobals());
it("shares suppression with Paper Doll across native subframes and disables permanent hooks on restore", () => {
	const native = { IsShown: () => shown, activeSubframe: "PaperDollFrame" };
	let shown = true;
	vi.stubGlobal("CharacterFrame", native);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const visibility = vi.fn();
	events.subscribe("REPUTATION_VISIBILITY_CHANGED", visibility);
	const client = new CharacterFrameClient(suppression, events);
	const paper = new BuiltInPaperDoll(client);
	const reputation = new BuiltInReputation(client);
	paper.disable();
	reputation.disable();
	native.activeSubframe = "ReputationFrame";
	for (const hook of hooks) hook();
	expect(reputation.isOpen()).toBe(true);
	expect(suppression.suppress).toHaveBeenLastCalledWith([native]);
	native.activeSubframe = "PaperDollFrame";
	for (const hook of hooks) hook();
	expect(reputation.isOpen()).toBe(false);
	const hide = vi.fn();
	vi.stubGlobal("HideUIPanel", hide);
	reputation.close();
	expect(hide).toHaveBeenCalledWith(native);
	shown = false;
	for (const hook of hooks) hook();
	expect(suppression.restore).toHaveBeenCalled();
	paper.restore();
	reputation.restore();
	const count = visibility.mock.calls.length;
	for (const hook of hooks) hook();
	expect(visibility).toHaveBeenCalledTimes(count);
});
