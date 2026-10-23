import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NativeDialogFrame } from "./native-dialog-navigation";
import { applyButtonSkin } from "./skin";

interface ActionButton extends NativeDialogFrame {
	SetText(text: string): void;
	SetFrameLevel(level: number): void;
	IsMouseOver(): boolean;
	SetNormalFontObject(name: string): void;
}

/** Pointer-only inset actions on native rows, excluded from logical navigation. */
export class NativeRowActions {
	private readonly entries = new Map<
		NativeDialogFrame,
		{
			button: ActionButton;
			original: ReturnType<NativeDialogFrame["GetScript"]>;
		}
	>();
	private readonly hooked = new Set<NativeDialogFrame>();
	constructor(private readonly pool: IFramePoolManager) {}
	bind(
		frame: NativeDialogFrame,
		primary: () => void,
		label: string,
		secondary: () => void,
	): void {
		let entry = this.entries.get(frame);
		if (!entry) {
			const button = this.pool.acquire("Button") as ActionButton;
			entry = { button, original: frame.GetScript("OnClick") };
			this.entries.set(frame, entry);
			button.SetParent(frame);
			button.ClearAllPoints();
			button.SetPoint("RIGHT", frame, "RIGHT", -8, 0);
			button.SetSize(112, 24);
			button.SetNormalFontObject("GameFontNormalSmall");
			applyButtonSkin(this.pool, button, false);
			button.SetFrameLevel(frame.GetFrameLevel() + 2);
			button.RegisterForClicks("LeftButtonUp");
			button.Hide();
			button.SetScript("OnLeave", () => {
				if (!(frame as ActionButton).IsMouseOver()) button.Hide();
			});
		}
		entry.button.SetText(label);
		entry.button.SetScript("OnClick", () => secondary());
		frame.SetScript("OnClick", () => {
			if (frame.IsEnabled()) primary();
		});
		if (this.hooked.has(frame)) return;
		this.hooked.add(frame);
		frame.HookScript("OnEnter", () => {
			if ((frame as ActionButton).IsMouseOver())
				this.entries.get(frame)?.button.Show();
		});
		frame.HookScript("OnLeave", () => {
			const button = this.entries.get(frame)?.button;
			if (
				button &&
				!(frame as ActionButton).IsMouseOver() &&
				!button.IsMouseOver()
			)
				button.Hide();
		});
		frame.HookScript("OnHide", () => this.entries.get(frame)?.button.Hide());
	}
	release(): void {
		for (const [frame, { button, original }] of this.entries) {
			frame.SetScript(
				"OnClick",
				original as
					| ((this: void, frame: WowFrame, button: string) => void)
					| undefined,
			);
			button.SetScript("OnClick", undefined);
			button.SetScript("OnLeave", undefined);
			button.SetText("");
			button.Hide();
			button.SetFrameLevel(0);
			button.ClearAllPoints();
			button.SetParent(undefined);
			this.pool.release("Button", button);
		}
		this.entries.clear();
	}
}
