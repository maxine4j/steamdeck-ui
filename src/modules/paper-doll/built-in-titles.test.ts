import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInTitles } from "./built-in-titles";

afterEach(() => vi.unstubAllGlobals());
it("routes only the native titles sidebar through the injected bus while enabled", () => {
	let callback: (frame: unknown, index: number) => void = () => {};
	const hook = vi.fn((_name: string, handler: typeof callback) => {
		callback = handler;
	});
	vi.stubGlobal("hooksecurefunc", hook);
	const native = { IsShown: () => true, activeSubframe: "PaperDollFrame" };
	vi.stubGlobal("CharacterFrame", native);
	const events = createTestEventBus(),
		open = vi.fn();
	events.subscribe("TITLES_OPEN", open);
	const integration = new BuiltInTitles(events);
	integration.disable();
	callback(undefined, 1);
	callback(undefined, 2);
	expect(open).toHaveBeenCalledOnce();
	native.activeSubframe = "ReputationFrame";
	callback(undefined, 2);
	expect(open).toHaveBeenCalledOnce();
	integration.restore();
	native.activeSubframe = "PaperDollFrame";
	callback(undefined, 2);
	expect(open).toHaveBeenCalledOnce();
	integration.disable();
	expect(hook).toHaveBeenCalledOnce();
});
