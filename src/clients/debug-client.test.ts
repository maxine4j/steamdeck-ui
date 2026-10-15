import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { DebugClient } from "./debug-client";

afterEach(() => vi.unstubAllGlobals());

it("captures Lua errors with stacks, defers opening, preserves the previous handler and restores on shutdown", () => {
	const previous = vi.fn();
	let handler: (message: string) => void = previous;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("debugstack", () => "stack trace");
	vi.stubGlobal("GetServerTime", () => 100);
	const pending: (() => void)[] = [];
	const events = createTestEventBus();
	const open = vi.fn();
	events.subscribe("DEBUG_OPEN_REQUESTED", open);
	const client = new DebugClient(events, {
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	client.initialize();
	client.initialize();
	handler("bad Lua");
	expect(client.diagnostics.report()).toContain("bad Lua\nstack trace");
	expect(previous).toHaveBeenCalledWith("bad Lua");
	expect(open).not.toHaveBeenCalled();
	pending.shift()?.();
	expect(open).toHaveBeenCalledOnce();
	client.shutdown();
	expect(handler).toBe(previous);
});
