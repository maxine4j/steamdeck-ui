import { expect, it, vi } from "vitest";
import { ModuleManager } from "./module-manager";

it("initializes modules once, shuts them down, and supports restart", () => {
	const module = {
		id: "test",
		disableBuiltIn: vi.fn(),
		initialize: vi.fn(),
		shutdown: vi.fn(),
	};
	const manager = new ModuleManager();
	manager.register(module);
	expect(() => manager.register(module)).toThrow("Duplicate module");
	manager.start();
	manager.start();
	expect(module.initialize).toHaveBeenCalledOnce();
	expect(module.disableBuiltIn).toHaveBeenCalledOnce();
	expect(module.disableBuiltIn.mock.invocationCallOrder.at(0)).toBeLessThan(
		module.initialize.mock.invocationCallOrder.at(0) ?? 0,
	);
	expect(() => manager.register({ ...module, id: "late" })).toThrow(
		"after startup",
	);
	manager.stop();
	manager.stop();
	expect(module.shutdown).toHaveBeenCalledOnce();
	manager.start();
	expect(module.initialize).toHaveBeenCalledTimes(2);
});
