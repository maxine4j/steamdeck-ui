import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager, type FrameType } from "../frame-pool-manager";
import { SecureRadialMenu } from "./secure-radial-menu";

afterEach(() => vi.unstubAllGlobals());

function setup(
	actions?: {
		slot: number;
		type: "pet" | "spell" | "item";
		value: number | string;
	}[],
) {
	vi.stubGlobal("UIParent", {});
	vi.stubGlobal("C_StringUtil", {
		CreateSecondsFormatter: () => ({
			SetDefaultAbbreviation: vi.fn(),
			SetConvertToLower: vi.fn(),
			SetStripIntervalWhitespace: vi.fn(),
			SetDesiredUnitCount: vi.fn(),
			SetMaxInterval: vi.fn(),
			SetMinInterval: vi.fn(),
			SetMillisecondsThreshold: vi.fn(),
		}),
	});
	const wrap = vi.fn(),
		unwrap = vi.fn(),
		execute = vi.fn();
	vi.stubGlobal("SecureHandlerWrapScript", wrap);
	vi.stubGlobal("SecureHandlerUnwrapScript", unwrap);
	vi.stubGlobal("SecureHandlerExecute", execute);
	const create = vi.fn((_type: FrameType) => {
		let lineCount = 0;
		const line = {
			SetStartPoint: vi.fn(),
			SetEndPoint: vi.fn(),
			SetThickness: vi.fn(),
			SetAtlas: vi.fn(),
			SetTexCoord: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetAllPoints: vi.fn(),
			SetColorTexture: vi.fn(),
			ClearAllPoints: vi.fn(),
			Show: vi.fn(),
			Hide: vi.fn(),
		};
		const attributes = new Map<string, unknown>();
		const scripts = new Map<string, (...args: unknown[]) => void>();
		const textures = new Map<string, ReturnType<typeof texture>>();
		function texture() {
			return {
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
		}
		return {
			line,
			CreateLine: vi.fn((_name, _layer) => {
				if (lineCount++ === 0) return line;
				return {
					...line,
					ClearAllPoints: vi.fn(),
					SetThickness: vi.fn(),
					SetStartPoint: vi.fn(),
					SetEndPoint: vi.fn(),
					SetColorTexture: vi.fn(),
					Show: vi.fn(),
					Hide: vi.fn(),
				};
			}),
			attributes,
			scripts,
			textures,
			GetName: () => "TestRing",
			SetAttribute: vi.fn((name: string, value: unknown) =>
				attributes.set(name, value),
			),
			GetAttribute: (name: string) => attributes.get(name),
			SetFrameRef: vi.fn(),
			SetParent: vi.fn(),
			SetSize: vi.fn(),
			SetPoint: vi.fn(),
			SetFrameStrata: vi.fn(),
			SetScript: vi.fn((name: string, handler: (...args: unknown[]) => void) =>
				scripts.set(name, handler),
			),
			SetPropagateKeyboardInput: vi.fn(),
			EnableGamePadStick: vi.fn(),
			EnableMouse: vi.fn(),
			RegisterForClicks: vi.fn(),
			Show: vi.fn(),
			Hide: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetCooldownFromDurationObject: vi.fn(),
			SetHideCountdownNumbers: vi.fn(),
			SetDrawEdge: vi.fn(),
			SetDrawSwipe: vi.fn(),
			SetCountdownFormatter: vi.fn(),
			Clear: vi.fn(),
			fonts: [] as {
				SetPoint: ReturnType<typeof vi.fn>;
				SetText: ReturnType<typeof vi.fn>;
			}[],
			CreateFontString() {
				const font = {
					SetPoint: vi.fn(),
					SetText: vi.fn(),
					SetWidth: vi.fn(),
					SetWordWrap: vi.fn(),
				};
				this.fonts.push(font);
				return font;
			},
			CreateTexture: () => {
				const result = texture();
				textures.set(String(textures.size), result);
				return result;
			},
		};
	});
	const pool = new FramePoolManager({
		createFrame: (type) => create(type) as unknown as WowFrame,
	});
	const menu = new SecureRadialMenu(pool, 12);
	const frames = create.mock.results.map((result) => result.value);
	const read = vi.fn(
		(slot: number): import("./secure-slot-button").SlotVisual => ({
			icon: slot,
			name: `Spell ${slot}`,
		}),
	);
	menu.configure(
		"PADDUP",
		{
			slots: Array.from({ length: 12 }, (_, i) => 37 + i),
			occupied: "return HasAction(slot)",
			position: "return 1, 0, 1",
			stick: "Right",
			virtualStick: "Camera",
			actions,
		},
		read,
		"",
		0.2,
	);
	frames.at(1)?.scripts.get("OnShow")?.();
	return { menu, create, frames, wrap, unwrap, execute, read, pool };
}

it("configures mixed secure actions and clears their attributes when pooled", () => {
	const { menu, frames, wrap } = setup([
		{ slot: 37, type: "pet", value: 1 },
		{ slot: 38, type: "spell", value: 123 },
		{ slot: 39, type: "item", value: "item:456" },
	]);
	const trigger = frames.at(0);
	expect(trigger.attributes.get("kind37")).toBe("pet");
	expect(trigger.attributes.get("value39")).toBe("item:456");
	expect(wrap.mock.calls.at(0)?.at(3)).toContain(
		'self:SetAttribute("typerelease", kind)',
	);
	menu.destroy();
	expect(trigger.attributes.get("kind37")).toBeUndefined();
	expect(trigger.attributes.get("value39")).toBeUndefined();
});

it("draws a circular sliced wheel and shows the selected compacted slot name in its center", () => {
	const { frames, menu } = setup();
	const display = frames.at(1),
		listener = frames.at(2);
	display.attributes.set("count", 2);
	frames.at(4).attributes.set("slot", 38);
	frames.at(5).attributes.set("slot", 47);
	menu.refresh();
	expect(display.CreateLine.mock.calls.length).toBeGreaterThan(100);
	const center = display.fonts.at(1);
	expect(center.SetPoint).toHaveBeenCalledWith(
		"CENTER",
		display,
		"CENTER",
		0,
		0,
	);
	listener.scripts.get("OnGamePadStick")(undefined, "Right", 0, -1, 1);
	expect(center.SetText).toHaveBeenLastCalledWith("Spell 47");
	listener.scripts.get("OnGamePadStick")(undefined, "Right", 0, 0, 0);
	expect(center.SetText).toHaveBeenLastCalledWith("");
	display.scripts.get("OnHide")();
	expect(center.SetText).toHaveBeenLastCalledWith("");
});

it("shows and clears the name on mouse hover without changing secure actions", () => {
	const { frames, menu } = setup();
	expect(frames.at(4).EnableMouse).toHaveBeenCalledWith(true);
	frames.at(1).attributes.set("count", 1);
	frames.at(4).attributes.set("slot", 38);
	menu.refresh();
	frames.at(4).scripts.get("OnEnter")?.();
	expect(frames.at(1).fonts.at(1).SetText).toHaveBeenLastCalledWith("Spell 38");
	frames.at(4).scripts.get("OnLeave")?.();
	expect(frames.at(1).fonts.at(1).SetText).toHaveBeenLastCalledWith("");
});

it("backs the center text with a translucent disk that selection does not recolor", () => {
	const { frames } = setup();
	const display = frames.at(1);
	const centerLines = display.CreateLine.mock.results
		.slice(129, 191)
		.map((result) => result.value);
	expect(centerLines).toHaveLength(62);
	for (const line of centerLines) {
		expect(line.SetThickness).toHaveBeenLastCalledWith(2);
		expect(line.SetColorTexture).toHaveBeenLastCalledWith(
			0.025,
			0.035,
			0.05,
			0.8,
		);
		expect(line.Show).toHaveBeenCalled();
	}
	display.attributes.set("count", 2);
	frames.at(2).scripts.get("OnGamePadStick")(undefined, "Right", 0, 1, 1);
	for (const line of centerLines)
		expect(line.SetColorTexture).toHaveBeenCalledOnce();
});

it("updates ring contents without rewrapping handlers or allocating for unchanged capacity", () => {
	const { menu, frames, create, wrap } = setup();
	const allocations = create.mock.calls.length;
	menu.setActions({
		slots: [1],
		actions: [{ slot: 1, type: "spell", value: 123 }],
	});
	expect(frames.at(0).attributes.get("slot1")).toBe(1);
	expect(frames.at(0).attributes.get("slot2")).toBeUndefined();
	expect(frames.at(0).attributes.get("value1")).toBe(123);
	expect(create).toHaveBeenCalledTimes(allocations);
	expect(wrap).toHaveBeenCalledOnce();
});

it("grows beyond twelve entries and returns the added controls to the frame pool", () => {
	const { menu, frames, create, pool } = setup();
	menu.setActions({
		slots: Array.from({ length: 15 }, (_, index) => index + 1),
	});
	expect(frames.at(0).attributes.get("capacity")).toBe(15);
	expect(frames.at(0).attributes.get("slot15")).toBe(15);
	expect(create).toHaveBeenCalledTimes(49);
	menu.destroy();
	new SecureRadialMenu(pool, 15);
	expect(create).toHaveBeenCalledTimes(49);
});

it("uses protected frames for every region manipulated by secure ring layout", () => {
	const { create } = setup();
	expect(create.mock.calls.map((call) => call.at(0))).toEqual([
		"SecureRingButton",
		"SecureFrame",
		"Frame",
		"Frame",
		...Array.from({ length: 12 }, () => "SecureFrame"),
		...Array.from({ length: 24 }, () => "Cooldown"),
	]);
});

it("renders native cooldown and recharge sweeps with countdown numbers for compacted ring slots", () => {
	const { menu, frames, read } = setup();
	const display = frames.at(1),
		item = frames.at(4);
	display.attributes.set("count", 1);
	item.attributes.set("slot", 47);
	const cooldown = {},
		recharge = {};
	read.mockReturnValue({ icon: 47, cooldown, recharge });
	menu.refresh();
	const chargeFrame = frames.at(16),
		cooldownFrame = frames.at(17);
	expect(chargeFrame.SetParent).toHaveBeenCalledWith(item);
	expect(cooldownFrame.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		item,
		"TOPLEFT",
		2,
		-2,
	);
	expect(cooldownFrame.SetHideCountdownNumbers).toHaveBeenCalledWith(false);
	expect(cooldownFrame.SetDrawSwipe).toHaveBeenCalledWith(true);
	expect(chargeFrame.SetCooldownFromDurationObject).toHaveBeenLastCalledWith(
		recharge,
		true,
	);
	expect(cooldownFrame.SetCooldownFromDurationObject).toHaveBeenLastCalledWith(
		cooldown,
		true,
	);
	read.mockReturnValue({ icon: 47 });
	menu.refresh();
	expect(chargeFrame.Clear).toHaveBeenCalledOnce();
	expect(cooldownFrame.Clear).toHaveBeenCalledOnce();
});

it("emits snippets accepted by WoW's restricted closure syntax checks", () => {
	const { frames, wrap, execute, menu } = setup();
	menu.destroy();
	const trigger = frames.at(0);
	const snippets = [
		...wrap.mock.calls.map((call) => call.at(3)),
		...execute.mock.calls.map((call) => call.at(1)),
		...trigger.SetAttribute.mock.calls
			.filter(([name]) => name === "occupied" || name === "position")
			.map((call) => call.at(1))
			.filter((body) => typeof body === "string"),
	];
	// RestrictedExecution.lua rejects these even inside comments or strings.
	for (const body of snippets) {
		expect(body).not.toMatch(/[{}]/);
		expect(body).not.toContain("function");
	}
});

it("installs secure down/up handling and keeps selection out of insecure scripts", () => {
	const { menu, frames, wrap } = setup();
	const trigger = frames.at(0);
	expect(trigger?.RegisterForClicks).toHaveBeenCalledWith("AnyDown", "AnyUp");
	expect(trigger?.attributes.get("pressAndHoldAction")).toBe(true);
	expect(wrap).toHaveBeenCalledWith(
		trigger,
		"PreClick",
		trigger,
		expect.stringContaining('self:SetAttribute("typerelease", "action")'),
	);
	expect(trigger?.attributes.get("occupied")).toBe(
		"local slot = ...\nreturn HasAction(slot)",
	);
	expect(menu.getBindingTarget().name).toBe("TestRing");
	const calls = trigger?.SetAttribute.mock.calls.length;
	frames.at(2)?.scripts.get("OnGamePadStick")?.(undefined, "Right", 1, 0, 1);
	expect(trigger?.SetAttribute.mock.calls.length).toBe(calls);
});

it("refreshes compacted slots, highlights the current sector and consumes only camera input", () => {
	const { frames, read, create } = setup();
	const display = frames.at(1),
		listener = frames.at(2),
		blocker = frames.at(3);
	display?.attributes.set("count", 2);
	frames.at(4)?.attributes.set("slot", 38);
	frames.at(5)?.attributes.set("slot", 47);
	display?.scripts.get("OnShow")?.();
	expect(read.mock.calls.map(([slot]) => slot)).toEqual([38, 47]);
	const allocations = create.mock.calls.length;
	blocker?.Show.mockClear();
	listener?.scripts.get("OnGamePadStick")?.(undefined, "Left", 1, 0, 1);
	expect(blocker?.Show).not.toHaveBeenCalled();
	listener?.scripts.get("OnGamePadStick")?.(undefined, "Right", 0, -1, 1);
	expect(blocker?.Show).toHaveBeenCalledOnce();
	const selectedBorder = frames.at(5)?.textures.get("1");
	expect(selectedBorder?.SetColorTexture).toHaveBeenLastCalledWith(
		1,
		0.82,
		0,
		1,
	);
	listener?.scripts.get("OnGamePadStick")?.(undefined, "Right", 0, 0, 0);
	expect(selectedBorder?.SetColorTexture).toHaveBeenLastCalledWith(
		0.42,
		0.47,
		0.55,
		1,
	);
	blocker?.Hide.mockClear();
	blocker?.scripts.get("OnGamePadStick")?.(undefined, "Camera", 0, -1, 1);
	expect(blocker?.Hide).toHaveBeenCalledOnce();
	expect(create.mock.calls.length).toBe(allocations);
});

it("tracks the exact stick direction continuously, including between positions in one sector", () => {
	const { frames } = setup();
	const display = frames.at(1),
		listener = frames.at(2);
	display.attributes.set("count", 2);
	const input = listener.scripts.get("OnGamePadStick");
	input(undefined, "Right", 0.6, 0.8, 1);
	expect(display.line.SetStartPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		expect.closeTo(37.2),
		expect.closeTo(49.6),
	);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		78,
		104,
	);
	expect(display.line.SetColorTexture).toHaveBeenLastCalledWith(
		1,
		0.82,
		0,
		0.9,
	);
	input(undefined, "Right", 0.8, 0.6, 1);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		104,
		78,
	);
	const updates = display.line.SetEndPoint.mock.calls.length;
	input(undefined, "Left", 0, 1, 1);
	expect(display.line.SetEndPoint.mock.calls.length).toBe(updates);
	display.attributes.set("count", 12);
	input(undefined, "Right", 0.6, 0.8, 1);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		78,
		104,
	);
	input(undefined, "Right", 0.6, 0.8, 0.5);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		expect.closeTo(57.6),
		expect.closeTo(76.8),
	);
});

it("shows subdued analogue feedback inside the deadzone and clears it on center, close and reopen", () => {
	const { frames } = setup();
	const display = frames.at(1),
		listener = frames.at(2);
	display.attributes.set("count", 2);
	const input = listener.scripts.get("OnGamePadStick");
	input(undefined, "Right", 0.15, 0.2, 0.25);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		47.4,
		63.2,
	);
	expect(display.line.SetColorTexture).toHaveBeenLastCalledWith(
		0.65,
		0.7,
		0.8,
		0.45,
	);
	expect(display.line.Show).toHaveBeenCalled();
	display.line.Hide.mockClear();
	input(undefined, "Right", 0, 0, 0);
	expect(display.line.Hide).toHaveBeenCalledOnce();
	display.scripts.get("OnHide")();
	expect(display.line.Hide).toHaveBeenCalledTimes(2);
	display.scripts.get("OnShow")();
	expect(display.line.Hide).toHaveBeenCalledTimes(3);
});

it("consumes camera input for 200ms after release without updating the hidden ring", () => {
	const { frames } = setup();
	const display = frames.at(1),
		listener = frames.at(2),
		blocker = frames.at(3);
	display.attributes.set("count", 2);
	display.scripts.get("OnHide")();
	listener.Hide.mockClear();
	display.line.Show.mockClear();
	blocker.Show.mockClear();
	const input = listener.scripts.get("OnGamePadStick");
	const update = listener.scripts.get("OnUpdate");
	update(undefined, 0.1);
	input(undefined, "Right", 1, 0, 1);
	expect(blocker.Show).toHaveBeenCalledOnce();
	expect(display.line.Show).not.toHaveBeenCalled();
	expect(listener.Hide).not.toHaveBeenCalled();
	input(undefined, "Left", 1, 0, 1);
	expect(blocker.Show).toHaveBeenCalledOnce();
	update(undefined, 0.099);
	expect(listener.Hide).not.toHaveBeenCalled();
	update(undefined, 0.002);
	expect(listener.Hide).toHaveBeenCalledOnce();
	input(undefined, "Right", 1, 0, 1);
	expect(blocker.Show).toHaveBeenCalledOnce();
});

it("preserves an armed camera blocker when the bind is released between stick events", () => {
	const { frames } = setup();
	const display = frames.at(1),
		listener = frames.at(2),
		blocker = frames.at(3);
	listener.scripts.get("OnGamePadStick")(undefined, "Right", 1, 0, 1);
	blocker.Hide.mockClear();
	display.scripts.get("OnHide")();
	expect(blocker.Hide).not.toHaveBeenCalled();
	blocker.scripts.get("OnGamePadStick")(undefined, "Camera", 1, 0, 1);
	expect(blocker.Hide).toHaveBeenCalledOnce();
});

it("keeps consuming input if the ring reopens during the release grace period", () => {
	const { frames } = setup();
	const display = frames.at(1),
		listener = frames.at(2),
		blocker = frames.at(3);
	display.scripts.get("OnHide")();
	listener.scripts.get("OnUpdate")(undefined, 0.1);
	display.scripts.get("OnShow")();
	listener.Hide.mockClear();
	blocker.Show.mockClear();
	listener.scripts.get("OnUpdate")(undefined, 0.5);
	listener.scripts.get("OnGamePadStick")(undefined, "Right", 1, 0, 1);
	expect(listener.Hide).not.toHaveBeenCalled();
	expect(blocker.Show).toHaveBeenCalledOnce();
});

it("clears handlers and temporary bindings and reuses every native frame", () => {
	const { menu, frames, create, unwrap, execute, pool } = setup();
	menu.destroy();
	expect(unwrap).toHaveBeenCalledWith(frames.at(0), "PreClick");
	expect(execute).toHaveBeenCalledWith(frames.at(0), "self:ClearBindings()");
	expect(frames.at(2)?.scripts.get("OnGamePadStick")).toBeUndefined();
	expect(frames.at(3)?.EnableGamePadStick).toHaveBeenLastCalledWith(false);
	expect(frames.at(0)?.attributes.get("held")).toBeUndefined();
	// Ring controls and their twenty-four cooldown frames return to the pool.
	new SecureRadialMenu(pool, 12);
	expect(create).toHaveBeenCalledTimes(40);
	expect(frames.at(1)?.CreateLine).toHaveBeenCalledTimes(203);
	expect(frames.at(1)?.line.ClearAllPoints).toHaveBeenCalledOnce();
});
