import { expect, it, vi } from "vitest";
import { Diagnostics } from "./diagnostics";

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
