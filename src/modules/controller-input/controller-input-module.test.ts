import { expect, it, vi } from "vitest";
import { ControllerInputModule } from "./controller-input-module";

it("configures input through its client without registering panels", () => {
	const client = {
		disableBuiltIn: vi.fn(),
		initialize: vi.fn(),
		setActive: vi.fn(),
		setSecureActions: vi.fn(),
		shutdown: vi.fn(),
	};
	const module = new ControllerInputModule(client);
	expect(module.id).toBe("controller-input");
	module.disableBuiltIn();
	module.initialize();
	module.shutdown();
	expect(client.disableBuiltIn).toHaveBeenCalledOnce();
	expect(client.initialize).toHaveBeenCalledOnce();
	expect(client.shutdown).toHaveBeenCalledOnce();
});
