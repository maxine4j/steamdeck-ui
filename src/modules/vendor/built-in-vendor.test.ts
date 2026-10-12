import { afterEach, expect, it, vi } from "vitest";
import { BuiltInVendor } from "./built-in-vendor";

afterEach(() => vi.unstubAllGlobals());
it("suppresses the merchant through generic frame operations and restores it", () => {
	const native = { GetParent: vi.fn() };
	vi.stubGlobal("_G", { MerchantFrame: native });
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const integration = new BuiltInVendor(frames);
	integration.disable();
	expect(frames.suppress).toHaveBeenCalledWith([native]);
	integration.restore();
	expect(frames.restore).toHaveBeenCalledOnce();
});
