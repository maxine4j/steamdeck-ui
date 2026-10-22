import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { DebugClient } from "./debug-client";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
	vi.stubGlobal("GetCallstackHeight", () => 10);
	vi.stubGlobal("GetErrorCallstackHeight", () => null);
	vi.stubGlobal("issecretvalue", () => false);
});

it("captures Lua errors with stacks, defers opening, preserves the previous handler and restores on shutdown", () => {
	const previous = vi.fn();
	let handler: (message: string) => void = previous;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("debugstack", () => "stack trace");
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
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

it("persists every occurrence and stack, evicts oldest beyond 100, and reloads history", () => {
	let handler = vi.fn() as (message: string) => void;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("debugstack", () => "original stack");
	vi.stubGlobal("GetServerTime", () => 123);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	const scheduler = { nextFrame: () => vi.fn() };
	const client = new DebugClient(createTestEventBus(), scheduler);
	client.initialize();
	for (let i = 0; i < 102; i++) handler(`error ${i}`);
	expect(SteamDeckUIErrors?.errors).toHaveLength(100);
	expect(SteamDeckUIErrors?.errors.at(0)).toMatchObject({
		message: "error 2",
		stack: "original stack",
		timestamp: 123,
	});
	client.shutdown();
	const reloaded = new DebugClient(createTestEventBus(), scheduler);
	expect(reloaded.loadErrors().errors.at(-1)?.message).toBe("error 101");
});

it("marks a loaded snapshot seen across sessions, including errors captured in the same second", () => {
	let handler = vi.fn() as (message: string) => void;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("debugstack", () => "stack");
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	const client = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	client.initialize();
	handler("first");
	const first = client.loadErrors();
	expect(first.errors.map(first.isNew)).toEqual([true]);
	expect(SteamDeckUIErrors?.lastViewedAt).toBe(100);
	handler("same second");
	const next = client.loadErrors();
	expect(next.errors.map(next.isNew)).toEqual([false, true]);
	expect(first.errors).toHaveLength(1);
	client.shutdown();
	const reloaded = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	const seen = reloaded.loadErrors();
	expect(seen.errors.map(seen.isNew)).toEqual([false, false]);
});

it("survives recursive failures in the previous handler and restores only its own hook", () => {
	let handler: (message: string) => void = () => handler("recursive");
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("debugstack", () => "stack");
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	const client = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	client.initialize();
	handler("outer");
	expect(SteamDeckUIErrors?.errors).toHaveLength(1);
	const other = vi.fn();
	handler = other;
	client.shutdown();
	expect(handler).toBe(other);
});

it("captures the original failing stack using Retail's error stack offset, with a fallback for manual reports", () => {
	let handler = vi.fn() as (message: string) => void;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	vi.stubGlobal("GetErrorCallstackHeight", () => 4);
	const stack = vi.fn((level: number) =>
		level === 7 ? "fault.lua:42" : "handler stack",
	);
	vi.stubGlobal("debugstack", stack);
	const client = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	client.initialize();
	handler("fault");
	expect(SteamDeckUIErrors?.errors.at(0)?.stack).toBe("fault.lua:42");
	vi.stubGlobal("GetErrorCallstackHeight", () => null);
	handler("manual");
	expect(stack).toHaveBeenLastCalledWith(2, 100, 100);
});

it("stores safe placeholders for secret error messages and stacks without inspecting them", () => {
	let handler = vi.fn() as (message: string) => void;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	vi.stubGlobal("debugstack", () => "secret stack");
	vi.stubGlobal("issecretvalue", () => true);
	const client = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	client.initialize();
	handler("secret message");
	expect(SteamDeckUIErrors?.errors.at(0)).toMatchObject({
		message: "Lua error message unavailable (secret value)",
		stack: "Stack trace unavailable (secret value)",
	});
});

it("records errors raised while opening the debug UI without recursively reopening it", () => {
	let handler = vi.fn() as (message: string) => void;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	vi.stubGlobal("debugstack", () => "stack");
	const events = createTestEventBus();
	events.subscribe("DEBUG_OPEN_REQUESTED", () => handler("UI error"));
	const pending: (() => void)[] = [];
	const client = new DebugClient(events, {
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	client.initialize();
	handler("original");
	pending.shift()?.();
	expect(SteamDeckUIErrors?.errors.map((error) => error.message)).toEqual([
		"original",
		"UI error",
	]);
	expect(pending).toHaveLength(0);
});

it("retains a readable report when Lua supplies a non-string error and no stack", () => {
	let handler: (message: unknown) => void = vi.fn();
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	vi.stubGlobal("debugstack", () => undefined);
	const client = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	client.initialize();
	handler(42);
	expect(SteamDeckUIErrors?.errors.at(0)).toMatchObject({
		message: "42",
		stack: "Stack trace unavailable",
	});
});
