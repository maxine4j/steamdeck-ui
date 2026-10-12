/** Generic reversible script suppression for existing native frames. */
export interface ScriptedFrame {
	GetScript(
		name: string,
	): ((this: void, ...args: unknown[]) => void) | undefined;
	SetScript(
		name: string,
		script?: (this: void, ...args: unknown[]) => void,
	): void;
	Hide(): void;
}
export class NativeScriptSuppression {
	private readonly originals = new Map<
		ScriptedFrame,
		Map<string, ((this: void, ...args: unknown[]) => void) | undefined>
	>();
	suppress(
		frame: ScriptedFrame,
		scripts: readonly string[],
		hide = false,
	): void {
		if (this.originals.has(frame)) return;
		const original = new Map<
			string,
			((this: void, ...args: unknown[]) => void) | undefined
		>();
		for (const script of scripts) {
			original.set(script, frame.GetScript(script));
			frame.SetScript(script, undefined);
		}
		this.originals.set(frame, original);
		if (hide) frame.Hide();
	}
	restore(): void {
		for (const [frame, scripts] of this.originals)
			for (const [name, script] of scripts) frame.SetScript(name, script);
		this.originals.clear();
	}
}
