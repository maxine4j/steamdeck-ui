import { afterEach, expect, it, vi } from "vitest";
import { FramePoolManager } from "../frame-pool-manager";
import { SecureSlotButton } from "./secure-slot-button";

afterEach(() => vi.unstubAllGlobals());

it("refreshes the actual secure slot on page changes and cleans pooled frames for reuse", () => {
	vi.stubGlobal("UIParent", {});
	const formatter = {
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
		SetColorTexture: vi.fn(),
		SetTexCoord: vi.fn(),
	};
	const label = { SetText: vi.fn(), SetFont: vi.fn(), SetPoint: vi.fn() };
	const makeFrame = () => ({
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		SetSize: vi.fn(),
		SetPoint: vi.fn((_point: string, relativeTo: unknown) => {
			if (!relativeTo)
				throw new Error(
					"Root buttons require an explicit anchor outside their child family",
				);
		}),
		ClearAllPoints: vi.fn(),
		CreateTexture: () => texture,
		CreateFontString: () => label,
		GetName: () => "SecureSlot",
		GetAttribute: () => action,
		SetAttribute: vi.fn((name: string, value?: number) => {
			if (name === "action") action = value;
			changed(undefined, name);
		}),
		RegisterForClicks: vi.fn(),
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
	});
	const frames = [makeFrame(), makeFrame(), makeFrame()];
	const create = vi.fn(() => frames.at(create.mock.calls.length - 1));
	const pool = new FramePoolManager({ createFrame: create });
	const register = vi.fn(),
		unregister = vi.fn();
	vi.stubGlobal("RegisterStateDriver", register);
	vi.stubGlobal("UnregisterStateDriver", unregister);
	const button = new SecureSlotButton(pool);
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
	expect(texture.SetColorTexture).toHaveBeenCalledWith(0.42, 0.47, 0.55, 1);
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
	expect(frames.at(0)?.RegisterForClicks).toHaveBeenCalledWith(
		"AnyDown",
		"AnyUp",
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
	expect(formatter.SetMaxInterval).toHaveBeenCalledWith(0);
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
	expect(frames.at(1)?.Clear).toHaveBeenCalledTimes(3);
	new SecureSlotButton(pool);
	expect(create).toHaveBeenCalledTimes(3);
});
