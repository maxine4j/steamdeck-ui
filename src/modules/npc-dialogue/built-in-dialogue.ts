import type {
	NativeScriptSuppression,
	ScriptedFrame,
} from "../../ui/components/native-script-suppression";
import type { IBuiltInDialogue } from "./dialogue-module";

type NativeHandler = (this: void, ...args: unknown[]) => void;
/** Feature adapter. Never reparents QuestFrame: its hide callback closes the quest. */
export class BuiltInDialogue implements IBuiltInDialogue {
	private enabled = false;
	private readonly handlers = new Map<
		Record<string, NativeHandler>,
		Map<string, NativeHandler>
	>();
	private readonly muted: NativeHandler = () => {};
	constructor(private readonly scripts: NativeScriptSuppression) {}
	disable(): void {
		this.enabled = true;
		this.refresh();
	}
	refresh(): void {
		if (!this.enabled) return;
		const globals = _G as unknown as Record<string, unknown>;
		for (const name of [
			"QuestFrame",
			"GossipFrame",
			"CustomGossipFrameManager",
		]) {
			const frame = globals[name] as ScriptedFrame | undefined;
			if (frame)
				this.scripts.suppress(
					frame,
					name === "CustomGossipFrameManager"
						? ["OnEvent"]
						: ["OnEvent", "OnShow", "OnHide"],
					name !== "CustomGossipFrameManager",
				);
		}
		// Retail GameEvent dispatches through these methods dynamically. Only owned prompts.
		const game = globals.GameEvent as Record<string, NativeHandler> | undefined;
		if (!game) return;
		let original = this.handlers.get(game);
		if (!original) {
			original = new Map();
			this.handlers.set(game, original);
		}
		for (const name of [
			"HandleGossipConfirm",
			"HandleGossipEnterCode",
			"HandleQuestAcceptConfirm",
		]) {
			const handler = game[name];
			if (handler && handler !== this.muted) {
				original.set(name, handler);
				game[name] = this.muted;
			}
		}
	}
	restore(): void {
		this.enabled = false;
		this.scripts.restore();
		for (const [game, handlers] of this.handlers)
			for (const [name, handler] of handlers)
				if (game[name] === this.muted) game[name] = handler;
		this.handlers.clear();
	}
}
