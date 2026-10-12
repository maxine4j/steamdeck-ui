import { afterEach, expect, it, vi } from "vitest";
import { ActionBarClient } from "./action-bar-client";

afterEach(() => vi.unstubAllGlobals());

it("keeps reserved bumper and trigger actions fixed across modifiers and main-bar paging", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	for (const slot of [155, 156]) {
		const driver = client.getSlotDriver(slot, "FIXED");
		expect(driver.condition).toBe(String(slot));
		expect(driver.response).toBe(
			'self:SetAttribute("action", tonumber(newstate))',
		);
	}
});

it("reserves the last two bar 6 slots outside the ability ring", () => {
	vi.stubGlobal("C_GamePad", { StickIndexToConfigName: () => undefined });
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	expect(client.getRingDriver().slots).toEqual(
		Array.from({ length: 10 }, (_, index) => 145 + index),
	);
});

it("routes the extra-action control through a secure extra-bar state with a zone spell fallback", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	const driver = client.getSlotDriver(6, "EXTRA");
	expect(driver.condition).toBe(
		"[mod:shift,mod:ctrl] 178; [mod:shift] 170; [mod:ctrl] 162; [extrabar] 217; -2",
	);
	expect(driver.response).toContain(
		'self:SetAttribute("type", action == -2 and "spell" or "action")',
	);
});

it("keeps unmodified Down on random favourite mount during all main-bar states", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	const driver = client.getSlotDriver(7, "MOUNT");
	expect(driver.condition).toBe(
		"[mod:shift,mod:ctrl] 179; [mod:shift] 171; [mod:ctrl] 163; -3",
	);
	expect(driver.response).toContain(
		'self:SetAttribute("macrotext", action == -3 and "/run C_MountJournal.SummonByID(0)" or nil)',
	);
	expect(driver.response).toContain(
		'self:SetAttribute("type", action == -3 and "macro" or "action")',
	);
});

it("uses the mount journal's random favourite mount icon", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	vi.stubGlobal("C_Spell", { GetSpellTexture: vi.fn(() => [901234, 901235]) });
	expect(client.read(-3).icon).toBe(901234);
	expect(C_Spell.GetSpellTexture).toHaveBeenCalledWith(150544);
});

it("reads the highest-priority zone spell and leaves an absent zone ability empty", () => {
	const abilities = [
		{ spellID: 456, uiPriority: 20 },
		{ spellID: 123, uiPriority: 10 },
	];
	vi.stubGlobal("C_ZoneAbility", {
		GetActiveAbilities: () => abilities,
		GetZoneAbilityIcon: (spell: number) => spell + 1,
	});
	vi.stubGlobal("C_Spell", {
		GetSpellCooldownDuration: () => undefined,
		GetSpellChargeDuration: () => undefined,
	});
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	expect(client.read(-2)).toEqual({ spell: 123, icon: 124 });
	abilities.length = 0;
	expect(client.read(-2)).toEqual({});
});

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

it("packs the eight controls into all 24 slots of Retail bars 7 and 8", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	const slots = Array.from({ length: 8 }, (_, i) => i + 1);
	const conditions = slots.map((slot) => client.getSlotDriver(slot).condition);
	for (const [prefix, start] of [
		["[mod:ctrl]", 157],
		["[mod:shift]", 165],
		["[mod:shift,mod:ctrl]", 173],
	] as const)
		expect(
			conditions.map((condition) =>
				Number(condition.split(`${prefix} `).at(1)?.split(";").at(0)),
			),
		).toEqual(slots.map((_, index) => start + index));
});

it("keeps dynamic main-bar paging for the face buttons and directions", () => {
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	for (const slot of [1, 4, 8]) {
		const driver = client.getSlotDriver(slot);
		// Modifier bars take priority even while the dynamic bar is active.
		expect(driver.condition).toBe(
			`[mod:shift,mod:ctrl] ${172 + slot}; [mod:shift] ${164 + slot}; [mod:ctrl] ${156 + slot}; ` +
				"[vehicleui] vehicle; [possessbar] possess; [overridebar] override; [shapeshift] shapeshift; " +
				"[bar:2] page2; [bar:3] page3; [bar:4] page4; [bar:5] page5; [bar:6] page6; " +
				"[bonusbar:1] bonus1; [bonusbar:2] bonus2; [bonusbar:3] bonus3; [bonusbar:4] bonus4; [bonusbar:5] bonus5; main",
		);
		// The restricted handler resolves the actual page at transition time.
		expect(driver.response).toContain("HasVehicleActionBar()");
		expect(driver.response).toContain("page = GetVehicleBarIndex()");
		expect(driver.response).toContain("page = GetOverrideBarIndex()");
		expect(driver.response).toContain("page = GetTempShapeshiftBarIndex()");
		expect(driver.response).toContain("page = GetBonusBarOffset() + 6");
		expect(driver.response).toContain("page = GetActionBarPage()");
		expect(driver.response).toContain(`action = (page - 1) * 12 + ${slot}`);
		expect(driver.response).toContain('self:SetAttribute("action", action)');
	}
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

it("binds unmodified A to native jump and keeps modified A on secondary actions", () => {
	const click = vi.fn();
	const bind = vi.fn();
	const clear = vi.fn();
	vi.stubGlobal("SetOverrideBindingClick", click);
	vi.stubGlobal("SetOverrideBinding", bind);
	vi.stubGlobal("ClearOverrideBindings", clear);
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	const target = { owner: {}, name: "JumpButton" };
	client.bind([{ key: "PAD1", target, defaultCommand: "JUMP" }]);
	expect(bind).toHaveBeenCalledExactlyOnceWith(
		target.owner,
		false,
		"PAD1",
		"JUMP",
	);
	expect(click).toHaveBeenCalledTimes(3);
	for (const prefix of ["SHIFT-", "CTRL-", "CTRL-SHIFT-"])
		expect(click).toHaveBeenCalledWith(
			target.owner,
			false,
			`${prefix}PAD1`,
			target.name,
			"LeftButton",
		);
	expect(client.getSlotDriver(4, "JUMP").condition).toBe(
		"[mod:shift,mod:ctrl] 176; [mod:shift] 168; [mod:ctrl] 160; 0",
	);
	client.restore();
	expect(clear).toHaveBeenCalledExactlyOnceWith(target.owner);
});

it("shows a dedicated jump icon without querying action slots or cooldowns", () => {
	const getTexture = vi.fn();
	const getCooldown = vi.fn();
	vi.stubGlobal("C_ActionBar", {
		GetActionTexture: getTexture,
		GetActionCooldownDuration: getCooldown,
	});
	const client = new ActionBarClient({ suppress: vi.fn(), restore: vi.fn() });
	expect(client.read(0)).toEqual({
		icon: "Interface\\AddOns\\SteamDeckUI\\assets\\Jump.png",
	});
	expect(getTexture).not.toHaveBeenCalled();
	expect(getCooldown).not.toHaveBeenCalled();
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
