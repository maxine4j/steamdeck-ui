import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

afterEach(() => vi.unstubAllGlobals());

function setup() {
	let down = false;
	let y = 100;
	vi.stubGlobal("IsMouseButtonDown", () => down);
	vi.stubGlobal("GetCursorPosition", () => [0, y]);
	vi.stubGlobal("InCombatLockdown", () => false);
	vi.stubGlobal("GetMouseFoci", () => [natives.at(1)]);
	const natives: ReturnType<typeof makeNative>[] = [];
	function makeNative() {
		let offset = 100;
		const scripts = new Map<
			string,
			((...args: unknown[]) => void) | undefined
		>();
		const attributes = new Map<string, string | number | boolean | undefined>();
		return {
			scripts,
			attributes,
			Hide: vi.fn(),
			Show: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetSize: vi.fn(),
			SetParent: vi.fn(),
			SetScript: (name: string, fn?: (...args: unknown[]) => void) =>
				scripts.set(name, fn),
			EnableMouseWheel: vi.fn(),
			EnableMouse: vi.fn(),
			SetPropagateMouseClicks: vi.fn(),
			GetParent: () => undefined,
			SetScrollChild: vi.fn(),
			RegisterForClicks: vi.fn(),
			RegisterForDrag: vi.fn(),
			GetHeight: () => 200,
			GetEffectiveScale: () => 2,
			IsMouseOver: () => true,
			GetVerticalScrollRange: () => 500,
			GetVerticalScroll: () => offset,
			SetVerticalScroll: (value: number) => {
				offset = value;
				scripts.get("OnVerticalScroll")?.();
			},
			SetAttribute: (name: string, value?: string | number | boolean) =>
				attributes.set(name, value),
			GetAttribute: (name: string) => attributes.get(name),
			CreateTexture: () => ({
				ClearAllPoints: vi.fn(),
				SetAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetWidth: vi.fn(),
				SetHeight: vi.fn(),
				SetColorTexture: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetAtlas: vi.fn(),
			}),
		};
	}
	const pool = new FramePoolManager({
		createFrame: () => {
			const native = makeNative();
			natives.push(native);
			return native as unknown as WowFrame;
		},
	});
	const viewport = new Frame("viewport", pool, "ScrollFrame");
	const content = new Frame("content", pool);
	content.setParent(viewport);
	viewport.setScrollContent(content);
	const native = natives.at(1);
	if (!native) throw new Error("Missing viewport");
	return {
		pool,
		viewport,
		content,
		native,
		natives,
		touch: (held: boolean, position: number) => {
			down = held;
			y = position;
		},
		tick: () => native.scripts.get("OnUpdate")?.(native, 0.016),
	};
}

it("pans from child controls, suppresses swipe clicks and item pickup, but preserves taps", () => {
	const s = setup();
	const button = new Frame("button", s.pool, "Button");
	button.setParent(s.content);
	const clicked = vi.fn();
	const pickup = vi.fn();
	button.onClick(clicked);
	button.onDragStart(pickup);
	const native = s.natives.at(-1);
	s.touch(true, 100);
	s.tick();
	s.touch(true, 160);
	s.tick();
	expect(s.native.GetVerticalScroll()).toBe(130);
	native?.scripts.get("OnDragStart")?.(native, "LeftButton");
	s.touch(false, 160);
	native?.scripts.get("OnClick")?.(native, "LeftButton");
	expect(clicked).not.toHaveBeenCalled();
	expect(pickup).not.toHaveBeenCalled();
	s.tick();
	s.touch(true, 160);
	s.tick();
	s.touch(false, 160);
	native?.scripts.get("OnClick")?.(native, "LeftButton");
	expect(clicked).toHaveBeenCalledOnce();
	s.native.scripts.get("OnHide")?.();
	const stopped = s.native.GetVerticalScroll();
	s.tick();
	expect(s.native.GetVerticalScroll()).toBe(stopped);
	s.viewport.destroy();
	expect(s.native.scripts.get("OnUpdate")).toBeUndefined();
});

it("cancels secure actions on swipe release and restores them for taps and controller clicks", () => {
	const s = setup();
	const button = new Frame("toy", s.pool, "SecureButton");
	button.setParent(s.content);
	button.setToy(42);
	const after = vi.fn();
	button.onPostClick(after);
	const native = s.natives.at(-1);
	s.touch(true, 100);
	s.tick();
	s.touch(true, 180);
	s.tick();
	s.touch(false, 180);
	native?.scripts.get("PreClick")?.(native, "LeftButton");
	expect(native?.attributes.get("type")).toBeUndefined();
	native?.scripts.get("PostClick")?.(native, "LeftButton");
	expect(native?.attributes.get("type")).toBe("toy");
	expect(after).not.toHaveBeenCalled();
	s.tick();
	s.touch(true, 180);
	s.tick();
	s.touch(false, 180);
	native?.scripts.get("PreClick")?.(native, "LeftButton");
	expect(native?.attributes.get("type")).toBe("toy");
	native?.scripts.get("PostClick")?.(native, "LeftButton");
	expect(after).toHaveBeenCalledOnce();
});

it("stops momentum when a viewport is hidden through its parent", () => {
	const s = setup();
	s.touch(true, 100);
	s.tick();
	s.touch(true, 180);
	s.tick();
	s.touch(false, 180);
	s.tick();
	s.native.scripts.get("OnHide")?.();
	const stopped = s.native.GetVerticalScroll();
	s.tick();
	expect(s.native.GetVerticalScroll()).toBe(stopped);
});

it("activates scroll-pane spells on release regardless of action-bar key-down settings", () => {
	const s = setup();
	const button = new Frame("spell", s.pool, "SecureButton");
	button.setParent(s.content);
	button.setSpell(123);
	expect(s.natives.at(-1)?.attributes.get("useOnKeyDown")).toBe(false);
});

it("consumes touch presses and releases so viewport swipes cannot reach the world camera", () => {
	const s = setup();
	expect(s.native.SetPropagateMouseClicks).toHaveBeenCalledWith(false);
	expect(s.native.scripts.get("OnMouseDown")).toBeTypeOf("function");
	expect(s.native.scripts.get("OnMouseUp")).toBeTypeOf("function");
	s.native.scripts.get("OnMouseDown")?.(s.native, "LeftButton");
	s.native.scripts.get("OnMouseUp")?.(s.native, "LeftButton");
	s.viewport.destroy();
	expect(s.native.scripts.get("OnMouseDown")).toBeUndefined();
	expect(s.native.scripts.get("OnMouseUp")).toBeUndefined();
});
