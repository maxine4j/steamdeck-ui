import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { Frame } from "./frame";
import { SecureClickBindings } from "./secure-click-bindings";

afterEach(() => vi.unstubAllGlobals());

it("binds named hardware targets, replaces stale keys, guards combat and cleans up before pooling", () => {
	let combat = false;
	vi.stubGlobal("InCombatLockdown", () => combat);
	const execute = vi.fn();
	const register = vi.fn();
	const unregister = vi.fn();
	vi.stubGlobal("SecureHandlerExecute", execute);
	vi.stubGlobal("RegisterStateDriver", register);
	vi.stubGlobal("UnregisterStateDriver", unregister);
	const owner = { SetAttribute: vi.fn() };
	const pool = {
		acquire: vi.fn(() => owner as unknown as WowFrame),
		release: vi.fn(),
	} as unknown as IFramePoolManager;
	const bindings = new SecureClickBindings(pool);
	const target = { secureClickName: () => "ToyButton42" } as Frame;
	bindings.set([{ key: "PAD3", target }]);
	expect(register).toHaveBeenCalledWith(
		owner,
		"combat",
		"[combat] combat; peace",
	);
	expect(owner.SetAttribute).toHaveBeenCalledWith(
		"_onstate-combat",
		'if newstate == "combat" then self:ClearBindings() end',
	);
	expect(owner.SetAttribute).toHaveBeenCalledWith("key1", "PAD3");
	expect(owner.SetAttribute).toHaveBeenCalledWith("target1", "ToyButton42");
	expect(execute.mock.lastCall?.at(1)).toContain("self:SetBindingClick");
	expect(owner.SetAttribute).toHaveBeenCalledWith("button1", "LeftButton");
	bindings.set([{ key: "PAD3", target, button: "RightButton" }]);
	expect(owner.SetAttribute).toHaveBeenCalledWith("button1", "RightButton");
	expect(execute.mock.lastCall?.at(1)).toContain(
		'self:GetAttribute("button"..i)',
	);
	combat = true;
	execute.mockClear();
	bindings.set([]);
	expect(execute).not.toHaveBeenCalled();
	combat = false;
	bindings.set([{ key: "PAD1", target }]);
	expect(owner.SetAttribute).toHaveBeenLastCalledWith("count", 1);
	bindings.destroy();
	expect(owner.SetAttribute).toHaveBeenCalledWith("key1", undefined);
	expect(owner.SetAttribute).toHaveBeenCalledWith("target1", undefined);
	expect(owner.SetAttribute).toHaveBeenCalledWith("button1", undefined);
	expect(unregister).toHaveBeenCalledWith(owner, "combat");
	expect(pool.release).toHaveBeenCalledWith("SecureFrame", owner);
});
