import { afterEach, expect, it, vi } from "vitest";
import { CharacterFrameClient } from "../../clients/character-frame-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { BuiltInPaperDoll } from "./built-in-paper-doll";

afterEach(() => vi.unstubAllGlobals());
it("retains native bindings, restores other character tabs and gates permanent hooks after shutdown", () => {
	let shown = true;
	const frame = { IsShown: () => shown, activeSubframe: "PaperDollFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		vi.fn((target: unknown, method: unknown, callback?: () => void) => {
			hooks.set(
				typeof target === "string" ? target : String(method),
				(callback ?? method) as () => void,
			);
		}),
	);
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("CHARACTER_VISIBILITY_CHANGED", changed);
	const adapter = new BuiltInPaperDoll(
		new CharacterFrameClient(suppression, events),
	);
	adapter.disable();
	expect(suppression.suppress).toHaveBeenCalledWith([frame]);
	frame.activeSubframe = "ReputationFrame";
	hooks.get("ShowSubFrame")?.();
	expect(suppression.restore).toHaveBeenCalled();
	frame.activeSubframe = "PaperDollFrame";
	hooks.get("ToggleCharacter")?.();
	shown = false;
	hooks.get("Hide")?.();
	adapter.restore();
	const count = changed.mock.calls.length;
	hooks.get("ToggleCharacter")?.();
	expect(changed).toHaveBeenCalledTimes(count);
});
