import { afterEach, expect, it, vi } from "vitest";
import { PerformanceClient } from "./performance-client";

afterEach(() => vi.unstubAllGlobals());

it("prints diagnostics locally and reads the existing profiling clock without resetting it", () => {
	const output = vi.fn();
	const reset = vi.fn();
	const transport = vi.fn();
	vi.stubGlobal("print", output);
	vi.stubGlobal("debugprofilestop", () => 123.5);
	vi.stubGlobal("debugprofilestart", reset);
	vi.stubGlobal("SendChatMessage", transport);
	const client = new PerformanceClient();
	expect(client.now()).toBe(123.5);
	client.log("pets scan complete");
	expect(output).toHaveBeenCalledExactlyOnceWith(
		"[SteamDeckUI performance] pets scan complete",
	);
	expect(reset).not.toHaveBeenCalled();
	expect(transport).not.toHaveBeenCalled();
});
