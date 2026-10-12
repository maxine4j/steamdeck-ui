import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager, type FrameType } from "../frame-pool-manager";
import { SecureRadialMenu } from "./secure-radial-menu";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	vi.stubGlobal("UIParent", {});
	const wrap = vi.fn(),
		unwrap = vi.fn(),
		execute = vi.fn();
	vi.stubGlobal("SecureHandlerWrapScript", wrap);
	vi.stubGlobal("SecureHandlerUnwrapScript", unwrap);
	vi.stubGlobal("SecureHandlerExecute", execute);
	const create = vi.fn((_type: FrameType) => {
		const line = {
			SetStartPoint: vi.fn(),
			SetEndPoint: vi.fn(),
			SetThickness: vi.fn(),
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
				SetColorTexture: vi.fn(),
				SetTexCoord: vi.fn(),
			};
		}
		return {
			line,
			CreateLine: vi.fn(() => line),
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
			RegisterForClicks: vi.fn(),
			Show: vi.fn(),
			Hide: vi.fn(),
			ClearAllPoints: vi.fn(),
			CreateFontString: () => ({ SetPoint: vi.fn(), SetText: vi.fn() }),
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
	const read = vi.fn((slot: number) => ({ icon: slot }));
	menu.configure(
		"PADDUP",
		{
			slots: Array.from({ length: 12 }, (_, i) => 37 + i),
			occupied: "return HasAction(slot)",
			position: "return 1, 0, 1",
			stick: "Right",
			virtualStick: "Camera",
		},
		read,
	);
	return { menu, create, frames, wrap, unwrap, execute, read, pool };
}

it("uses protected frames for every region manipulated by secure ring layout", () => {
	const { create } = setup();
	expect(create.mock.calls.map((call) => call.at(0))).toEqual([
		"SecureRingButton",
		"SecureFrame",
		"Frame",
		"Frame",
		...Array.from({ length: 12 }, () => "SecureFrame"),
	]);
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
		0,
		0,
	);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		42,
		56,
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
		56,
		42,
	);
	const updates = display.line.SetEndPoint.mock.calls.length;
	input(undefined, "Left", 0, 1, 1);
	expect(display.line.SetEndPoint.mock.calls.length).toBe(updates);
	display.attributes.set("count", 12);
	input(undefined, "Right", 0.6, 0.8, 1);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		72,
		96,
	);
	input(undefined, "Right", 0.6, 0.8, 0.5);
	expect(display.line.SetEndPoint).toHaveBeenLastCalledWith(
		"CENTER",
		display,
		36,
		48,
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
		10.5,
		14,
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

it("clears handlers and temporary bindings and reuses every native frame", () => {
	const { menu, frames, create, unwrap, execute, pool } = setup();
	menu.destroy();
	expect(unwrap).toHaveBeenCalledWith(frames.at(0), "PreClick");
	expect(execute).toHaveBeenCalledWith(frames.at(0), "self:ClearBindings()");
	expect(frames.at(2)?.scripts.get("OnGamePadStick")).toBeUndefined();
	expect(frames.at(3)?.EnableGamePadStick).toHaveBeenLastCalledWith(false);
	expect(frames.at(0)?.attributes.get("held")).toBeUndefined();
	// The component returns all sixteen frames to its injected pool.
	new SecureRadialMenu(pool, 12);
	expect(create).toHaveBeenCalledTimes(16);
	expect(frames.at(1)?.CreateLine).toHaveBeenCalledOnce();
	expect(frames.at(1)?.line.ClearAllPoints).toHaveBeenCalledOnce();
});
