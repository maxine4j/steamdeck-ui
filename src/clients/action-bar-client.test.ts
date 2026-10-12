import { afterEach, expect, it, vi } from "vitest";
import { ActionBarClient } from "./action-bar-client";

afterEach(() => vi.unstubAllGlobals());

it("suppresses all eight standard action bars once and restores their parents", () => {
	const bars = [
		"MainActionBar",
		"MultiBarBottomLeft",
		"MultiBarBottomRight",
		"MultiBarLeft",
		"MultiBarRight",
		"MultiBar5",
		"MultiBar6",
		"MultiBar7",
	];
	const frames = bars.map((name) => {
		const frame = { GetParent: vi.fn(), SetParent: vi.fn() };
		vi.stubGlobal(name, frame);
		return frame;
	});
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const client = new ActionBarClient(suppression);
	client.disableBuiltIn();
	client.disableBuiltIn();
	expect(suppression.suppress).toHaveBeenCalledExactlyOnceWith(frames);
	client.restore();
	expect(suppression.restore).toHaveBeenCalledOnce();
});

it("selects the first ten slots of Retail Edit Mode bars 1, 6, 7, and 8", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	expect(client.getSlotDriver(1)).toBe(
		"[mod:shift,mod:ctrl] 169; [mod:shift] 145; [mod:ctrl] 157; 1",
	);
	expect(client.getSlotDriver(8)).toBe(
		"[mod:shift,mod:ctrl] 176; [mod:shift] 152; [mod:ctrl] 164; 8",
	);
	expect(client.getSlotDriver(9)).toBe(
		"[mod:shift,mod:ctrl] 177; [mod:shift] 153; [mod:ctrl] 165; 9",
	);
	expect(client.getSlotDriver(10)).toBe(
		"[mod:shift,mod:ctrl] 178; [mod:shift] 154; [mod:ctrl] 166; 10",
	);
});

it("reveals native bars only for action drags, hides them after dropping, and defers changes in combat", () => {
	for (const name of [
		"MainActionBar",
		"MultiBarBottomLeft",
		"MultiBarBottomRight",
		"MultiBarLeft",
		"MultiBarRight",
		"MultiBar5",
		"MultiBar6",
		"MultiBar7",
	])
		vi.stubGlobal(name, {});
	let cursor: string | undefined;
	let combat = false;
	vi.stubGlobal("GetCursorInfo", () => [cursor]);
	vi.stubGlobal("InCombatLockdown", () => combat);
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const client = new ActionBarClient(frames);
	client.disableBuiltIn();
	client.syncBuiltInVisibility();
	expect(frames.suppress).toHaveBeenCalledOnce();
	cursor = "spell";
	client.syncBuiltInVisibility();
	expect(frames.restore).toHaveBeenCalledOnce();
	cursor = undefined;
	client.syncBuiltInVisibility();
	expect(frames.suppress).toHaveBeenCalledTimes(2);
	cursor = "money";
	client.syncBuiltInVisibility();
	expect(frames.restore).toHaveBeenCalledOnce();
	cursor = "macro";
	combat = true;
	client.syncBuiltInVisibility();
	expect(frames.restore).toHaveBeenCalledOnce();
	combat = false;
	client.syncBuiltInVisibility();
	expect(frames.restore).toHaveBeenCalledTimes(2);
});

it("binds every modifier combination without changing saved bindings or controller settings", () => {
	const bind = vi.fn();
	const clear = vi.fn();
	const setCVar = vi.fn();
	vi.stubGlobal("SetOverrideBindingClick", bind);
	vi.stubGlobal("ClearOverrideBindings", clear);
	vi.stubGlobal("C_CVar", {
		GetCVar: (name: string) => `original-${name}`,
		SetCVar: setCVar,
	});
	vi.stubGlobal("InCombatLockdown", () => false);
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const client = new ActionBarClient(suppression);
	const target = { owner: {}, name: "CrossButton" };
	client.bind(
		["PAD1", "PADRTRIGGER", "PADRSHOULDER"].map((key) => ({ key, target })),
	);
	for (const key of ["PAD1", "PADRTRIGGER", "PADRSHOULDER"])
		for (const prefix of ["", "SHIFT-", "CTRL-", "CTRL-SHIFT-"])
			expect(bind).toHaveBeenCalledWith(
				target.owner,
				false,
				`${prefix}${key}`,
				target.name,
				"LeftButton",
			);
	client.restore();
	expect(clear).toHaveBeenCalledWith(target.owner);
	expect(setCVar).not.toHaveBeenCalled();
});

it("passes opaque native cooldown durations through without arithmetic", () => {
	const duration = {};
	const charge = {};
	vi.stubGlobal("C_ActionBar", {
		GetActionTexture: vi.fn(() => 123),
		GetActionCooldownDuration: vi.fn(() => duration),
		GetActionChargeDuration: vi.fn(() => charge),
	});
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	expect(client.read(61)).toEqual({
		icon: 123,
		cooldown: duration,
		recharge: charge,
	});
	expect(C_ActionBar.GetActionCooldownDuration).toHaveBeenCalledWith(61, false);
});

it("preserves absent durations for actions without an active cooldown or charges", () => {
	vi.stubGlobal("C_ActionBar", {
		GetActionTexture: () => 236165,
		GetActionCooldownDuration: () => undefined,
		GetActionChargeDuration: () => undefined,
	});
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	expect(client.read(1)).toEqual({
		icon: 236165,
		cooldown: undefined,
		recharge: undefined,
	});
});
