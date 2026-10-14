import { expect, it, vi } from "vitest";
import { TargetingModule } from "./targeting-module";

it("shows the small gold targeting marker on startup and releases it on shutdown", () => {
	const view = { show: vi.fn(), destroy: vi.fn() };
	const client = { getPosition: () => 0.6 };
	const module = new TargetingModule(view, client);
	module.disableBuiltIn();
	module.initialize();
	expect(view.show).toHaveBeenCalledWith(
		14,
		[1, 0.82, 0.2],
		expect.any(Function),
	);
	expect(view.show.mock.calls.at(0)?.at(2)()).toBe(0.6);
	module.shutdown();
	expect(view.destroy).toHaveBeenCalledOnce();
});
