import { afterEach, expect, it, vi } from "vitest";
import { Diagnostics } from "./diagnostics";
import { PerformanceClient, WorkMeasurement } from "./performance-client";

afterEach(() => vi.unstubAllGlobals());

it("contains failures in profiling and fallback chat logging without recursive output", () => {
	vi.stubGlobal("debugprofilestop", () => {
		throw Error("profiler failed");
	});
	const client = new PerformanceClient();
	const output = vi.fn(() => {
		client.log("recursive");
		throw Error("chat failed");
	});
	vi.stubGlobal("print", output);
	expect(client.now()).toBe(0);
	expect(() => client.log("original")).not.toThrow();
	expect(output).toHaveBeenCalledOnce();
	output.mockImplementation(() => {});
	client.log("recovered");
	expect(output).toHaveBeenCalledTimes(2);
});

it("marks failed work in diagnostics and preserves the exception for WoW's error handler", () => {
	vi.stubGlobal("debugprofilestop", () => 0);
	const diagnostics = new Diagnostics(() => 100);
	const scan = new WorkMeasurement(
		new PerformanceClient(diagnostics),
		"pets scan",
		"login",
	);
	const error = new Error("journal failed");
	expect(() =>
		scan.measure("journal", () => {
			throw error;
		}),
	).toThrow(error);
	expect(diagnostics.jobs().at(0)?.state).toBe("failed");
});

it("allows a scan owner to report completed metrics while preserving live progress and failures", () => {
	let time = 0;
	vi.stubGlobal("debugprofilestop", () => time);
	const diagnostics = new Diagnostics(() => 100);
	const report = vi.fn();
	const scan = new WorkMeasurement(
		new PerformanceClient(diagnostics),
		"category",
		"login",
		report,
	);
	expect(diagnostics.report()).toBe("");
	time = 12;
	scan.page(0);
	scan.finish("complete");
	scan.finish("complete");
	expect(report).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({
			state: "complete",
			elapsed: 12,
			maxPage: 12,
			pages: 1,
			message: expect.stringContaining("category complete"),
		}),
	);
	expect(diagnostics.jobs().at(0)?.state).toBe("complete");
	const failed = new WorkMeasurement(
		new PerformanceClient(diagnostics),
		"category",
		"login",
		report,
	);
	expect(() =>
		failed.measure("journal", () => {
			throw Error("broken");
		}),
	).toThrow("broken");
	expect(report).toHaveBeenLastCalledWith(
		expect.objectContaining({ state: "failed" }),
	);
});

it("routes logs and live work progress to central diagnostics including completion and cancellation", () => {
	vi.stubGlobal("print", vi.fn());
	let time = 0;
	vi.stubGlobal("debugprofilestop", () => time);
	const diagnostics = new Diagnostics(() => 100);
	const performance = new PerformanceClient(diagnostics);
	const scan = new WorkMeasurement(performance, "mounts scan", "server-event");
	scan.progress(20, 45);
	expect(diagnostics.report()).toContain(
		"mounts scan start reason=server-event",
	);
	expect(diagnostics.jobs().at(0)).toMatchObject({
		completed: 20,
		total: 45,
		reason: "server-event",
		state: "running",
	});
	time = 25;
	scan.finish("cancelled");
	expect(diagnostics.jobs().at(0)).toMatchObject({
		state: "cancelled",
		elapsed: 25,
	});
});

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
