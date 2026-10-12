import { afterEach, expect, it, vi } from "vitest";
import { NativeScriptSuppression } from "../../ui/components/native-script-suppression";
import { BuiltInDialogue } from "./built-in-dialogue";

afterEach(() => vi.unstubAllGlobals());
it("suppresses dialogue handlers before hiding and restores native routing, including late frames", () => {
	const closed = vi.fn();
	const scripts = new Map([
		["OnEvent", vi.fn()],
		["OnHide", closed],
		["OnShow", vi.fn()],
	]);
	const frame = {
		GetScript: (s: string) => scripts.get(s),
		SetScript: (s: string, f: ReturnType<typeof vi.fn>) => scripts.set(s, f),
		Hide: () => scripts.get("OnHide")?.(),
	};
	const confirm = vi.fn(),
		unrelated = vi.fn();
	const game = {
		HandleGossipConfirm: confirm,
		HandleGossipEnterCode: confirm,
		HandleQuestAcceptConfirm: confirm,
		HandleQuestLogUpdate: unrelated,
	};
	const globals: Record<string, unknown> = {
		QuestFrame: frame,
		GameEvent: game,
	};
	vi.stubGlobal("_G", globals);
	const native = new BuiltInDialogue(new NativeScriptSuppression());
	native.disable();
	game.HandleGossipConfirm();
	expect(confirm).not.toHaveBeenCalled();
	expect(closed).not.toHaveBeenCalled();
	expect(game.HandleQuestLogUpdate).toBe(unrelated);
	const lateScripts = new Map([["OnEvent", vi.fn()]]);
	const late = {
		GetScript: (s: string) => lateScripts.get(s),
		SetScript: (s: string, f: ReturnType<typeof vi.fn>) =>
			lateScripts.set(s, f),
		Hide: vi.fn(),
	};
	globals.CustomGossipFrameManager = late;
	native.refresh();
	native.restore();
	expect(game.HandleGossipConfirm).toBe(confirm);
	expect(scripts.get("OnHide")).toBe(closed);
	expect(scripts.get("OnEvent")).toBeDefined();
});
