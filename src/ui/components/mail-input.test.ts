import { expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("sets editable text and configures bounded multiline fields without submitting on Enter", () => {
	const scripts = new Map<string, (() => void) | undefined>();
	const native = {
		SetAutoFocus: vi.fn(),
		SetFontObject: vi.fn(),
		SetTextInsets: vi.fn(),
		SetScript: vi.fn((name: string, callback: () => void) =>
			scripts.set(name, callback),
		),
		SetMultiLine: vi.fn(),
		SetMaxLetters: vi.fn(),
		SetText: vi.fn(),
		SetFocus: vi.fn(),
		HighlightText: vi.fn(),
		GetText: () => "hello",
		ClearFocus: vi.fn(),
	};
	const pool = {
		acquire: () => native,
		getBackground: vi.fn(),
	} as unknown as IFramePoolManager;
	const frame = new Frame("input", pool, "EditBox");
	const change = vi.fn();
	frame.configureTextInput(change, true, 8000);
	frame.setInputText("reply");
	expect(native.SetMultiLine).toHaveBeenCalledWith(true);
	expect(native.SetMaxLetters).toHaveBeenCalledWith(8000);
	expect(native.SetText).toHaveBeenCalledWith("reply");
	expect(scripts.get("OnEnterPressed")).toBeUndefined();
	scripts.get("OnTextChanged")?.();
	expect(change).toHaveBeenCalledWith("hello");
	frame.selectInputText();
	expect(native.SetFocus).toHaveBeenCalledOnce();
	expect(native.HighlightText).toHaveBeenCalledWith(0, -1);
});

it("scrolls a multiline field to keep the cursor visible", () => {
	let cursor:
		| ((
				frame: unknown,
				x: number,
				y: number,
				width: number,
				height: number,
		  ) => void)
		| undefined;
	const native = {
		SetAutoFocus: vi.fn(),
		SetFontObject: vi.fn(),
		SetTextInsets: vi.fn(),
		SetMultiLine: vi.fn(),
		SetMaxLetters: vi.fn(),
		GetHeight: () => 300,
		SetScript: (name: string, handler: typeof cursor) => {
			if (name === "OnCursorChanged") cursor = handler;
		},
	};
	const pool = {
		acquire: () => native,
		getBackground: vi.fn(),
	} as unknown as IFramePoolManager;
	const frame = new Frame("input", pool, "EditBox");
	const scroll = new Frame("viewport", pool, "ScrollFrame");
	const reveal = vi
		.spyOn(scroll, "revealVerticalRange")
		.mockImplementation(() => {});
	frame.configureTextInput(vi.fn(), true, 500, scroll);
	cursor?.(native, 0, -200, 5, 18);
	expect(reveal).toHaveBeenCalledWith(200, 218, 300);
});
