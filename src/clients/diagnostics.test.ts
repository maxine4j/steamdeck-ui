import { expect, it, vi } from "vitest";
import { Diagnostics } from "./diagnostics";

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
	diagnostics.subscribe(() => {
		expect(saved.at(-1)).toBe("[100] INFO breadcrumb");
	});
	diagnostics.log("info", "breadcrumb");
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
