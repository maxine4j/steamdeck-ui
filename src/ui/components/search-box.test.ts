import { afterEach, expect, it, vi } from "vitest";
import type { IFramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

afterEach(() => vi.unstubAllGlobals());

it("preserves native search presentation while delivering text changes and clearing pooled input", () => {
	let text = "dragon";
	const scripts = new Map<string, (() => void) | undefined>();
	const native = {
		SetAutoFocus: vi.fn(),
		SetFontObject: vi.fn(),
		SetTextInsets: vi.fn(),
		GetText: () => text,
		SetText: (value: string) => {
			text = value;
			scripts.get("OnTextChanged")?.();
		},
		ClearFocus: vi.fn(),
		SetScript: (script: string, callback?: () => void) =>
			scripts.set(script, callback),
	};
	const template = vi.fn();
	vi.stubGlobal("SearchBoxTemplate_OnTextChanged", template);
	const pool = {
		acquire: () => native,
		getBackground: () => ({ SetColorTexture: vi.fn() }),
		release: vi.fn(),
	} as unknown as IFramePoolManager;
	const frame = new Frame("search", pool, "SearchBox");
	const changed = vi.fn();
	frame.configureInput(changed);
	scripts.get("OnTextChanged")?.();
	expect(template).toHaveBeenCalledWith(native);
	expect(changed).toHaveBeenCalledWith("dragon");
	expect(native.SetTextInsets).not.toHaveBeenCalled();
	changed.mockClear();
	frame.destroy();
	expect(text).toBe("");
	expect(changed).not.toHaveBeenCalled();
	expect(pool.release).toHaveBeenCalledWith("SearchBox", native);
});
