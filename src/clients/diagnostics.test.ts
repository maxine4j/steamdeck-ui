import { expect, it, vi } from "vitest";
import { Diagnostics } from "./diagnostics";

it("isolates persistence and observer failures, blocks recursive logging and recovers", () => {
	const persist = vi.fn(() => {
		throw Error("saved variables unavailable");
	});
	const diagnostics = new Diagnostics(() => 100, 500, persist);
	const healthy = vi.fn();
	diagnostics.subscribe(() => {
		diagnostics.log("error", "recursive");
		throw Error("broken debug panel");
	});
	diagnostics.subscribe(healthy);
	expect(() => diagnostics.log("info", "original")).not.toThrow();
	expect(diagnostics.report()).toContain("original");
	expect(diagnostics.report()).not.toContain("recursive");
	expect(healthy).toHaveBeenCalledOnce();
	persist.mockImplementation(() => {});
	diagnostics.log("info", "recovered");
	expect(diagnostics.report()).toContain("recovered");
	expect(persist).toHaveBeenCalledTimes(2);
});

it("contains clock and formatting failures and prevents work observer recursion", () => {
	const diagnostics = new Diagnostics(() => {
		throw Error("clock unavailable");
	});
	expect(() => diagnostics.log("info", "without clock")).not.toThrow();
	expect(diagnostics.report()).toContain("without clock");
	const progress = {
		id: 1,
		label: "scan",
		reason: "login",
		completed: 1,
		total: 2,
		state: "running",
		elapsed: 0,
	};
	diagnostics.subscribe(() => {
		diagnostics.work(progress);
		throw Error("observer failed");
	});
	expect(() => diagnostics.work(progress)).not.toThrow();
	expect(diagnostics.jobs()).toHaveLength(1);
	const malformed = {
		slice: () => {
			throw Error("restricted message");
		},
	} as unknown as string;
	expect(() => diagnostics.log("info", malformed)).not.toThrow();
	expect(() => diagnostics.log("info", "later")).not.toThrow();
	expect(diagnostics.report()).toContain("later");
});

it("attaches build identity to every persisted log line", () => {
	const persist = vi.fn();
	const diagnostics = new Diagnostics(
		() => 100,
		500,
		persist,
		"build=abc123-dirty",
	);
	diagnostics.log("info", "event NAV_INTERACT");
	diagnostics.log("error", "failure");
	expect(persist.mock.calls).toEqual([
		["[100] INFO build=abc123-dirty event NAV_INTERACT"],
		["[100] ERROR build=abc123-dirty failure"],
	]);
});

it("persists formatted logs before notifying UI observers", () => {
	const saved: string[] = [];
	const diagnostics = new Diagnostics(
		() => 100,
		2,
		(line) => saved.push(line),
	);
	const observed: (string | undefined)[] = [];
	diagnostics.subscribe(() => observed.push(saved.at(-1)));
	diagnostics.log("info", "breadcrumb");
	expect(observed).toEqual(["[100] INFO breadcrumb"]);
	expect(saved).toEqual(["[100] INFO breadcrumb"]);
});

it("retains bounded timestamped logs and publishes structured work progress without losing reasons", () => {
	let time = 100;
	const diagnostics = new Diagnostics(() => time, 2);
	const changed = vi.fn();
	const detach = diagnostics.subscribe(changed);
	diagnostics.log("info", "first");
	time = 105;
	diagnostics.log("error", "failure\nstack");
	diagnostics.log("info", "last");
	expect(diagnostics.report()).not.toContain("first");
	expect(diagnostics.report()).toContain("[105] ERROR failure\nstack");
	diagnostics.work({
		id: 1,
		label: "mounts scan",
		reason: "login",
		completed: 20,
		total: 45,
		state: "running",
		elapsed: 12,
	});
	expect(diagnostics.jobs()).toEqual([
		expect.objectContaining({ reason: "login", completed: 20, total: 45 }),
	]);
	diagnostics.work({
		id: 1,
		label: "mounts scan",
		reason: "login",
		completed: 45,
		total: 45,
		state: "complete",
		elapsed: 30,
	});
	expect(diagnostics.jobs()).toHaveLength(1);
	expect(diagnostics.jobs().at(0)?.state).toBe("complete");
	detach();
	changed.mockClear();
	diagnostics.log("info", "detached");
	expect(changed).not.toHaveBeenCalled();
});
