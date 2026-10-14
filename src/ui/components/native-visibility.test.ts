import { afterEach, expect, it, vi } from "vitest";
import { NativeVisibility } from "./native-visibility";

afterEach(() => vi.unstubAllGlobals());
it("hides existing chrome through native show calls and restores original visibility without changing parents", () => {
	const hooks = new Map<string, () => void>();
	vi.stubGlobal(
		"hooksecurefunc",
		(_region: unknown, method: string, callback: () => void) =>
			hooks.set(method, callback),
	);
	let shown = true;
	const region = {
		IsShown: () => shown,
		Show: vi.fn(() => {
			shown = true;
		}),
		Hide: vi.fn(() => {
			shown = false;
		}),
	};
	const visibility = new NativeVisibility();
	visibility.hide([region]);
	expect(shown).toBe(false);
	region.Show();
	hooks.get("Show")?.();
	expect(shown).toBe(false);
	visibility.hide([region]);
	visibility.restore();
	expect(shown).toBe(true);
	region.Show();
	hooks.get("Show")?.();
	expect(shown).toBe(true);
});
it("leaves originally hidden regions hidden on restoration", () => {
	vi.stubGlobal("hooksecurefunc", vi.fn());
	const region = { IsShown: () => false, Show: vi.fn(), Hide: vi.fn() };
	const visibility = new NativeVisibility();
	visibility.hide([region]);
	visibility.restore();
	expect(region.Show).not.toHaveBeenCalled();
	expect(region.Hide).toHaveBeenCalled();
});
