import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BUILD_COMMIT } from "../build-info";
import { createTestEventBus } from "../events/test-event-bus";
import { DebugClient } from "./debug-client";
import { Diagnostics } from "./diagnostics";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
	vi.stubGlobal("GetTime", () => 0);
	vi.stubGlobal("GetCallstackHeight", () => 10);
	vi.stubGlobal("GetErrorCallstackHeight", () => null);
	vi.stubGlobal("issecretvalue", () => false);
});

function captureHarness() {
	const previous = vi.fn();
	let handler: (message: unknown) => void = previous;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("debugstack", () => "original stack");
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	const diagnostics = new Diagnostics(() => 100);
	const context = {
		capture: vi.fn(() => ({
			buildCommit: "test",
			details: {},
			unavailableFields: [],
		})),
	};
	const callbacks: (() => void)[] = [];
	const scheduler = {
		nextFrame: vi.fn((callback: () => void) => {
			callbacks.push(callback);
			return vi.fn();
		}),
	};
	const events = createTestEventBus();
	const client = new DebugClient(events, scheduler, true, diagnostics, context);
	client.initialize();
	return {
		previous,
		diagnostics,
		context,
		scheduler,
		callbacks,
		events,
		client,
		report: (message: unknown) => handler(message),
	};
}

it("clears persisted and live telemetry, resets flood suppression and captures fresh errors", () => {
	const harness = captureHarness();
	vi.stubGlobal("SteamDeckUILogs", {
		version: 1,
		entries: ["old log"],
		droppedCount: 4,
	});
	for (let i = 0; i < 12; i++) harness.report("old failure");
	harness.client.loadErrors();
	harness.diagnostics.work({
		id: 1,
		label: "old scan",
		reason: "login",
		completed: 1,
		total: 1,
		state: "done",
		elapsed: 1,
	});
	harness.client.clearAll();
	expect(SteamDeckUILogs).toEqual({ version: 1, entries: [], droppedCount: 0 });
	expect(harness.client.loadErrors()).toMatchObject({
		errors: [],
		suppressedCount: 0,
	});
	expect(harness.diagnostics.report()).toBe("");
	expect(harness.diagnostics.jobs()).toEqual([]);
	harness.report("fresh failure");
	const fresh = harness.client.loadErrors();
	expect(fresh.errors).toHaveLength(1);
	expect(fresh.errors.at(0)?.message).toBe("fresh failure");
	expect(fresh.errors.map(fresh.isNew)).toEqual([true]);
	expect(harness.diagnostics.report()).not.toContain("old failure");
});

it.each([
	"stack",
	"context",
	"report",
	"log",
	"scheduler",
	"previous",
	"storage",
	"clock",
	"secret",
	"message",
])(
	"contains a failing %s stage and releases the recursion guard for later errors",
	(stage) => {
		const harness = captureHarness();
		const fail = () => {
			throw Error("capture itself failed");
		};
		if (stage === "stack") vi.stubGlobal("debugstack", fail);
		if (stage === "context") harness.context.capture.mockImplementation(fail);
		if (stage === "report")
			vi.spyOn(harness.diagnostics, "report").mockImplementation(fail);
		if (stage === "log")
			vi.spyOn(harness.diagnostics, "log").mockImplementation(fail);
		if (stage === "scheduler")
			harness.scheduler.nextFrame.mockImplementation(fail);
		if (stage === "previous")
			harness.previous.mockImplementation(() => {
				harness.report("recursive");
				fail();
			});
		if (stage === "storage")
			vi.stubGlobal("SteamDeckUIErrors", new Proxy({}, { get: fail }));
		if (stage === "clock") {
			vi.stubGlobal("GetTime", fail);
			vi.stubGlobal("GetServerTime", fail);
		}
		if (stage === "secret") vi.stubGlobal("issecretvalue", fail);
		const message =
			stage === "message" ? { toString: fail } : "original failure";
		expect(() => harness.report(message)).not.toThrow();
		expect(harness.previous).toHaveBeenCalledExactlyOnceWith(message);
		if (stage !== "storage")
			expect(SteamDeckUIErrors?.errors.at(-1)?.environment?.buildCommit).toBe(
				stage === "context" ? BUILD_COMMIT : "test",
			);
		if (!["storage", "secret", "message"].includes(stage))
			expect(SteamDeckUIErrors?.errors).toHaveLength(1);
		vi.restoreAllMocks();
		vi.stubGlobal("GetTime", () => 1);
		vi.stubGlobal("GetServerTime", () => 101);
		vi.stubGlobal("issecretvalue", () => false);
		vi.stubGlobal("debugstack", () => "recovered stack");
		vi.stubGlobal("SteamDeckUIErrors", undefined);
		harness.previous.mockImplementation(() => {});
		harness.context.capture.mockImplementation(() => ({
			buildCommit: "test",
			details: {},
			unavailableFields: [],
		}));
		expect(() => harness.report("later failure")).not.toThrow();
		expect(SteamDeckUIErrors?.errors.at(-1)?.message).toBe("later failure");
	},
);

it("contains deferred debug UI failures and never schedules another auto-open", () => {
	const harness = captureHarness();
	harness.events.subscribe("DEBUG_OPEN_REQUESTED", () => {
		harness.report("UI recursive failure");
		throw Error("debug UI failed");
	});
	harness.report("original failure");
	expect(() => harness.callbacks.shift()?.()).not.toThrow();
	harness.report("next failure");
	expect(harness.scheduler.nextFrame).toHaveBeenCalledOnce();
	expect(harness.callbacks).toHaveLength(0);
});

it("returns an empty snapshot if saved error history cannot be read", () => {
	const harness = captureHarness();
	vi.stubGlobal(
		"SteamDeckUIErrors",
		new Proxy(
			{},
			{
				get: () => {
					throw Error("unreadable history");
				},
			},
		),
	);
	expect(() => harness.client.loadErrors()).not.toThrow();
	expect(harness.client.loadErrors().errors).toEqual([]);
});

it("contains initialization failures and permits a later successful retry", () => {
	const previous = vi.fn();
	let handler: (message: unknown) => void = previous;
	const set = vi.fn((_next: typeof handler) => {
		throw Error("hook unavailable");
	});
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", set);
	vi.stubGlobal("GetServerTime", () => 100);
	const client = new DebugClient(createTestEventBus(), {
		nextFrame: () => vi.fn(),
	});
	expect(() => client.initialize()).not.toThrow();
	set.mockImplementation((next) => {
		handler = next;
	});
	client.initialize();
	expect(handler).not.toBe(previous);
	client.shutdown();
	expect(handler).toBe(previous);
});

it("restores the previous error handler even when shutdown logging and cancellation fail", () => {
	const harness = captureHarness();
	harness.scheduler.nextFrame.mockImplementation(() => () => {
		throw Error("cancel failed");
	});
	harness.report("original failure");
	vi.spyOn(harness.diagnostics, "log").mockImplementation(() => {
		throw Error("logging failed");
	});
	expect(() => harness.client.shutdown()).not.toThrow();
	expect(geterrorhandler()).toBe(harness.previous);
});

it("leaves Blizzard's error handler and saved history untouched when capture is disabled", () => {
	const previous = vi.fn();
	const getHandler = vi.fn(() => previous);
	const setHandler = vi.fn();
	vi.stubGlobal("geterrorhandler", getHandler);
	vi.stubGlobal("seterrorhandler", setHandler);
	const saved = {
		version: 1,
		errors: [
			{ id: 1, timestamp: 10, message: "saved error", stack: "saved stack" },
		],
	};
	vi.stubGlobal("SteamDeckUIErrors", saved);
	const nextFrame = vi.fn();
	const client = new DebugClient(createTestEventBus(), { nextFrame }, false);
	client.initialize();
	client.initialize();
	client.shutdown();
	expect(getHandler).not.toHaveBeenCalled();
	expect(setHandler).not.toHaveBeenCalled();
	expect(nextFrame).not.toHaveBeenCalled();
	expect(SteamDeckUIErrors).toBe(saved);
	expect(saved.errors).toHaveLength(1);
});

it("captures Lua errors, opens debug once across frames, preserves the previous handler and restores on shutdown", () => {
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
	const client = new DebugClient(
		events,
		{
			nextFrame: (callback) => {
				pending.push(callback);
				return vi.fn();
			},
		},
		true,
		undefined,
		{
			capture: () => ({
				buildCommit: "abc123",
				details: { zone: "Dornogal", groupSize: 3 },
				unavailableFields: [],
			}),
		},
	);
	client.initialize();
	client.initialize();
	client.diagnostics.log("info", "event NAV_INTERACT");
	handler("bad Lua");
	expect(SteamDeckUIErrors?.errors.at(-1)?.environment).toMatchObject({
		buildCommit: "abc123",
		details: { zone: "Dornogal", groupSize: 3 },
	});
	expect(SteamDeckUIErrors?.errors.at(-1)?.context).toContain(
		"event NAV_INTERACT",
	);
	client.diagnostics.log("info", "later event");
	expect(SteamDeckUIErrors?.errors.at(-1)?.context).not.toContain(
		"later event",
	);
	expect(client.diagnostics.report()).toContain("session started");
	expect(client.diagnostics.report()).toContain("bad Lua\nstack trace");
	expect(previous).toHaveBeenCalledWith("bad Lua");
	expect(open).not.toHaveBeenCalled();
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(open).toHaveBeenCalledOnce();
	handler("repeated menu error");
	expect(pending).toHaveLength(0);
	expect(open).toHaveBeenCalledOnce();
	client.shutdown();
	expect(client.diagnostics.report()).toContain("session stopped");
	expect(handler).toBe(previous);
});

it("persists every occurrence and stack, evicts oldest beyond 100, and reloads history", () => {
	let clock = 0;
	vi.stubGlobal("GetTime", () => clock++);
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

it("bounds expensive capture and previous-handler work during floods, counts suppression, recovers and opens debug only once", () => {
	const previous = vi.fn();
	let handler = previous as (message: string) => void;
	vi.stubGlobal("geterrorhandler", () => handler);
	vi.stubGlobal("seterrorhandler", (next: typeof handler) => {
		handler = next;
	});
	vi.stubGlobal("GetServerTime", () => 100);
	vi.stubGlobal("SteamDeckUIErrors", undefined);
	const stack = vi.fn(() => "original menu error stack");
	vi.stubGlobal("debugstack", stack);
	let clock = 0;
	vi.stubGlobal("GetTime", () => clock);
	const events = createTestEventBus();
	const open = vi.fn();
	events.subscribe("DEBUG_OPEN_REQUESTED", open);
	const pending: (() => void)[] = [];
	const client = new DebugClient(events, {
		nextFrame: (callback) => {
			pending.push(callback);
			return vi.fn();
		},
	});
	client.initialize();
	for (let i = 0; i < 1000; i++) handler("repeated menu error");
	expect(stack).toHaveBeenCalledTimes(10);
	expect(previous).toHaveBeenCalledTimes(10);
	expect(SteamDeckUIErrors?.errors).toHaveLength(10);
	expect(SteamDeckUIErrors?.errors.at(0)?.stack).toBe(
		"original menu error stack",
	);
	expect(SteamDeckUIErrors?.suppressedCount).toBe(990);
	expect(pending).toHaveLength(1);
	pending.shift()?.();
	expect(open).toHaveBeenCalledOnce();
	clock = 1;
	for (let i = 0; i < 1000; i++) handler("repeated menu error");
	expect(stack).toHaveBeenCalledTimes(20);
	expect(previous).toHaveBeenCalledTimes(20);
	expect(client.loadErrors().suppressedCount).toBe(1980);
	expect(SteamDeckUIErrors?.lastSuppressedAt).toBe(100);
	expect(pending).toHaveLength(0);
	expect(open).toHaveBeenCalledOnce();
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
