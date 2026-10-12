import { afterEach, expect, it, vi } from "vitest";
import { ActionBarClient } from "./action-bar-client";

afterEach(() => vi.unstubAllGlobals());

it("uses all twelve slots of Edit Mode bar 6 and resolves the raw right stick", () => {
	vi.stubGlobal("C_GamePad", {
		StickIndexToConfigName: (index: number) =>
			["Left", "Right", "Gyro"].at(index),
	});
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	const driver = client.getRingDriver();
	expect(driver.slots).toEqual(Array.from({ length: 12 }, (_, i) => 145 + i));
	expect(driver.occupied).toBe("return HasAction(slot)");
	expect(driver.position).toContain("GetGamePadState()");
	expect(driver.position).toContain("state.sticks[2]");
	expect(driver.stick).toBe("Right");
	expect(driver.virtualStick).toBe("Camera");
});

it("binds a ring only to the unmodified key and clears it on restore", () => {
	const click = vi.fn();
	vi.stubGlobal("SetOverrideBindingClick", click);
	const clear = vi.fn();
	vi.stubGlobal("ClearOverrideBindings", clear);
	const target = { owner: {}, name: "Ring" };
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	client.bind([{ key: "PADDUP", target, prefixes: [""] }]);
	expect(click).toHaveBeenCalledExactlyOnceWith(
		target.owner,
		false,
		"PADDUP",
		"Ring",
		"LeftButton",
	);
	client.restore();
	expect(clear).toHaveBeenCalledExactlyOnceWith(target.owner);
});

it("shows a ring icon on unmodified Up and preserves modified slot five", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	const driver = client.getSlotDriver(5, "RING");
	expect(driver.condition).toBe(
		"[mod:shift,mod:ctrl] 177; [mod:shift] 169; [mod:ctrl] 161; -1",
	);
	expect(client.read(-1).icon).toBe("Interface\\Icons\\INV_Misc_EngGizmos_19");
});
