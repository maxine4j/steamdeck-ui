import { afterEach, expect, it, vi } from "vitest";
import { FramePoolManager } from "../frame-pool-manager";
import { SecureSlotButton } from "./secure-slot-button";

afterEach(() => vi.unstubAllGlobals());

it("refreshes the actual secure slot on page changes and cleans pooled frames for reuse", () => {
	vi.stubGlobal("UIParent", {});
	const formatter = {
		SetDefaultAbbreviation: vi.fn(),
		SetConvertToLower: vi.fn(),
		SetStripIntervalWhitespace: vi.fn(),
		SetDesiredUnitCount: vi.fn(),
		SetMaxInterval: vi.fn(),
		SetMinInterval: vi.fn(),
		SetMillisecondsThreshold: vi.fn(),
	};
	vi.stubGlobal("C_StringUtil", { CreateSecondsFormatter: () => formatter });
	let action: number | undefined;
	let changed: (frame: unknown, name: string) => void = () => {};
	const texture = {
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetWidth: vi.fn(),
		SetHeight: vi.fn(),
		SetAllPoints: vi.fn(),
		SetTexture: vi.fn(),
		SetAtlas: vi.fn(),
		SetColorTexture: vi.fn(),
		SetTexCoord: vi.fn(),
	};
	const label = { SetText: vi.fn(), SetFont: vi.fn(), SetPoint: vi.fn() };
	const makeFrame = () => {
		// CooldownFrameTemplate starts with anchors to its original parent.
		const anchors = new Map<string, unknown>([
			["TOPLEFT", UIParent],
			["BOTTOMRIGHT", UIParent],
		]);
		return {
			anchors,
			Hide: vi.fn(),
			Show: vi.fn(),
			SetParent: vi.fn(),
			SetSize: vi.fn(),
			SetPoint: vi.fn((_point: string, relativeTo: unknown) => {
				if (!relativeTo)
					throw new Error(
						"Root buttons require an explicit anchor outside their child family",
					);
				anchors.set(_point, relativeTo);
			}),
			ClearAllPoints: vi.fn(() => anchors.clear()),
			CreateTexture: () => texture,
			CreateFontString: () => label,
			GetName: () => "SecureSlot",
			GetAttribute: () => action,
			SetAttribute: vi.fn((name: string, value?: number) => {
				if (name === "action") action = value;
				changed(undefined, name);
			}),
			RegisterForClicks: vi.fn(),
			RegisterForDrag: vi.fn(),
			SetScript: vi.fn((script: string, handler: typeof changed) => {
				if (script === "OnAttributeChanged") changed = handler;
			}),
			HookScript: vi.fn((script: string, handler: typeof changed) => {
				if (script === "OnAttributeChanged") changed = handler;
			}),
			SetCooldownFromDurationObject: vi.fn(),
			SetCountdownFormatter: vi.fn(),
			SetHideCountdownNumbers: vi.fn(),
			SetDrawEdge: vi.fn(),
			SetDrawSwipe: vi.fn(),
			Clear: vi.fn(),
		};
	};
	const frames = [makeFrame(), makeFrame(), makeFrame()];
	const create = vi.fn(() => frames.at(create.mock.calls.length - 1));
	const pool = new FramePoolManager({ createFrame: create });
	const register = vi.fn(),
		unregister = vi.fn();
	vi.stubGlobal("RegisterStateDriver", register);
	vi.stubGlobal("UnregisterStateDriver", unregister);
	const button = new SecureSlotButton(pool);
	const expectButtonAnchors = () => {
		for (const cooldown of frames.slice(1)) {
			expect(cooldown.SetParent).toHaveBeenLastCalledWith(frames.at(0));
			expect([...cooldown.anchors]).toEqual([
				["TOPLEFT", frames.at(0)],
				["BOTTOMRIGHT", frames.at(0)],
			]);
		}
	};
	expectButtonAnchors();
	const duration = {},
		recharge = {};
	const read = vi.fn((slot: number) => ({
		icon: slot,
		cooldown: duration,
		recharge,
	}));
	button.refresh(read);
	expect(read).not.toHaveBeenCalled();
	button.configure("A", 110, 56, 1, "[mod:shift] 145; 1", read);
	button.setSpell(123);
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith("spell", 123);
	expect(texture.SetAtlas).toHaveBeenCalledWith(
		"UI-HUD-ActionBar-IconFrame",
		false,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		frames.at(0),
		"TOPLEFT",
		2,
		-2,
	);
	expect(frames.at(1)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMRIGHT",
		frames.at(0),
		"BOTTOMRIGHT",
		-2,
		2,
	);
	expect(frames.at(0)?.SetPoint).toHaveBeenCalledWith(
		"BOTTOM",
		UIParent,
		"BOTTOM",
		110,
		56,
	);
	expect(frames.at(0)?.HookScript).toHaveBeenCalledWith(
		"OnAttributeChanged",
		expect.any(Function),
	);
	expect(frames.at(0)?.SetScript).not.toHaveBeenCalledWith(
		"OnAttributeChanged",
		expect.anything(),
	);
	expect(register).toHaveBeenCalledWith(
		frames.at(0),
		"slot",
		"[mod:shift] 145; 1",
	);
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith(
		"_onstate-slot",
		'self:SetAttribute("action", tonumber(newstate))',
	);
	expect(frames.at(0)?.RegisterForClicks).toHaveBeenCalledExactlyOnceWith(
		"AnyUp",
	);
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith(
		"useOnKeyDown",
		false,
	);
	expect(frames.at(0)?.RegisterForDrag).toHaveBeenCalledWith("LeftButton");
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith(
		"_ondragstart",
		`local action = self:GetAttribute("action")
if button == "LeftButton" and action and action > 0 and not SecureCmdOptionParse("[combat] true") then
	return "action", action
end`,
	);
	action = 145;
	changed(frames.at(0), "action");
	expect(read).toHaveBeenLastCalledWith(145);
	expect(texture.SetTexture).toHaveBeenLastCalledWith(145);
	expect(frames.at(1)?.SetCooldownFromDurationObject).toHaveBeenLastCalledWith(
		recharge,
		true,
	);
	expect(frames.at(2)?.SetCooldownFromDurationObject).toHaveBeenLastCalledWith(
		duration,
		true,
	);
	expect(frames.at(2)?.SetHideCountdownNumbers).toHaveBeenCalledWith(false);
	expect(frames.at(2)?.SetCountdownFormatter).toHaveBeenCalledWith(formatter);
	expect(formatter.SetDefaultAbbreviation).toHaveBeenCalledWith(2);
	expect(formatter.SetConvertToLower).toHaveBeenCalledWith(true);
	expect(formatter.SetStripIntervalWhitespace).toHaveBeenCalledWith(2);
	expect(formatter.SetDesiredUnitCount).toHaveBeenCalledWith(1);
	expect(formatter.SetMaxInterval).toHaveBeenCalledWith(1);
	expect(formatter.SetMinInterval).toHaveBeenCalledWith(0);
	// Actions without a cooldown or charges return no duration object at runtime.
	const before =
		frames.at(1)?.SetCooldownFromDurationObject.mock.calls.length ?? 0;
	button.refresh(() => ({ icon: 236165 }));
	expect(frames.at(1)?.SetCooldownFromDurationObject).toHaveBeenCalledTimes(
		before,
	);
	expect(frames.at(1)?.Clear).toHaveBeenCalledOnce();
	expect(frames.at(2)?.Clear).toHaveBeenCalledOnce();
	button.refresh(() => ({ cooldown: duration }));
	expect(frames.at(1)?.SetCooldownFromDurationObject).toHaveBeenCalledTimes(
		before,
	);
	expect(frames.at(2)?.SetCooldownFromDurationObject).toHaveBeenLastCalledWith(
		duration,
		true,
	);
	const reads = read.mock.calls.length;
	action = undefined;
	changed(frames.at(0), "action");
	expect(read).toHaveBeenCalledTimes(reads);
	button.destroy();
	expect(unregister).toHaveBeenCalledWith(frames.at(0), "slot");
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith("type", undefined);
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith("spell", undefined);
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith(
		"_ondragstart",
		undefined,
	);
	expect(frames.at(0)?.RegisterForDrag).toHaveBeenLastCalledWith();
	expect(frames.at(1)?.Clear).toHaveBeenCalledTimes(3);
	const reused = new SecureSlotButton(pool);
	const response = 'self:SetAttribute("action", 121)';
	const jumpIcon = "Interface\\AddOns\\SteamDeckUI\\assets\\Jump.png";
	const jumpRead = vi.fn((slot: number) =>
		slot === 0 ? { icon: jumpIcon } : read(slot),
	);
	reused.configure(
		"A",
		110,
		56,
		0,
		{ condition: "[vehicleui] vehicle; main", response },
		jumpRead,
	);
	expect(texture.SetTexture).toHaveBeenLastCalledWith(jumpIcon);
	action = 148;
	changed(frames.at(0), "action");
	expect(texture.SetTexture).toHaveBeenLastCalledWith(148);
	const cooldownClears = frames.at(2)?.Clear.mock.calls.length ?? 0;
	action = 0;
	changed(frames.at(0), "action");
	expect(texture.SetTexture).toHaveBeenLastCalledWith(jumpIcon);
	expect(frames.at(2)?.Clear).toHaveBeenCalledTimes(cooldownClears + 1);
	expect(register).toHaveBeenLastCalledWith(
		frames.at(0),
		"slot",
		"[vehicleui] vehicle; main",
	);
	expect(frames.at(0)?.SetAttribute).toHaveBeenCalledWith(
		"_onstate-slot",
		response,
	);
	reused.destroy();
	new SecureSlotButton(pool);
	expectButtonAnchors();
	expect(create).toHaveBeenCalledTimes(3);
});
