import { afterEach, expect, it, vi } from "vitest";
import { TargetingClient } from "./targeting-client";

afterEach(() => vi.unstubAllGlobals());

it("reads the centered cursor height used by ConsolePort and follows setting changes", () => {
	const getCVar = vi.fn(() => "0.6");
	vi.stubGlobal("C_CVar", { GetCVar: getCVar });
	const client = new TargetingClient();
	expect(client.getPosition()).toBe(0.6);
	expect(getCVar).toHaveBeenCalledWith("CursorCenteredYPos");
	getCVar.mockReturnValue("0.4");
	expect(client.getPosition()).toBe(0.4);
});
