import { afterEach, expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

afterEach(() => vi.unstubAllGlobals());

it("reuses a looping atlas animation and stops it before releasing its frame", () => {
	const flipbook = {
		SetDuration: vi.fn(),
		SetOrder: vi.fn(),
		SetFlipBookRows: vi.fn(),
		SetFlipBookColumns: vi.fn(),
		SetFlipBookFrames: vi.fn(),
	};
	const group = {
		CreateAnimation: vi.fn(() => flipbook),
		SetLooping: vi.fn(),
		Play: vi.fn(),
		Stop: vi.fn(),
		IsPlaying: () => false,
	};
	const texture = {
		ClearAllPoints: vi.fn(),
		SetAllPoints: vi.fn(),
		SetTexture: vi.fn(),
		SetTexCoord: vi.fn(),
		SetColorTexture: vi.fn(),
		SetAtlas: vi.fn(),
		CreateAnimationGroup: vi.fn(() => group),
	};
	const native = {
		Hide: vi.fn(),
		Show: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		CreateTexture: () => texture,
	};
	const frame = new Frame(
		"animated",
		new FramePoolManager({ createFrame: () => native }),
	);
	const atlas = {
		atlas: "test-atlas",
		rows: 8,
		columns: 11,
		frames: 80,
		duration: 2,
	};
	frame.setAnimatedAtlas(atlas);
	frame.setAnimatedAtlas(atlas);
	expect(texture.CreateAnimationGroup).toHaveBeenCalledOnce();
	expect(flipbook.SetFlipBookFrames).toHaveBeenCalledWith(80);
	expect(group.SetLooping).toHaveBeenCalledWith("REPEAT");
	frame.show();
	expect(group.Play).toHaveBeenCalled();
	group.Stop.mockClear();
	frame.hide();
	expect(group.Stop).toHaveBeenCalled();
	frame.destroy();
	expect(group.Stop).toHaveBeenCalledTimes(2);
});

it("passes item cooldowns through to a pooled native cooldown and clears it on release", () => {
	const native = {
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetScript: vi.fn(),
		SetCooldown: vi.fn(),
		Clear: vi.fn(),
		SetHideCountdownNumbers: vi.fn(),
		SetDrawEdge: vi.fn(),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	};
	const frame = new Frame(
		"cooldown",
		new FramePoolManager({ createFrame: () => native }),
		"Cooldown",
	);
	frame.setCooldown(10, 60);
	expect(native.SetCooldown).toHaveBeenCalledExactlyOnceWith(10, 60);
	frame.destroy();
	expect(native.Clear).toHaveBeenCalledOnce();
});

it("configures secure toy activation and clears toy attributes before pooling", () => {
	let combat = false;
	vi.stubGlobal("InCombatLockdown", () => combat);
	const native = {
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetScript: vi.fn(),
		RegisterForClicks: vi.fn(),
		SetAttribute: vi.fn(),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	};
	const frame = new Frame(
		"toy",
		new FramePoolManager({ createFrame: () => native }),
		"SecureButton",
	);
	frame.setToy(42);
	const after = vi.fn();
	frame.onPostClick(after);
	expect(native.SetScript).toHaveBeenCalledWith(
		"PostClick",
		expect.any(Function),
	);
	expect(native.SetAttribute).toHaveBeenCalledWith("type", "toy");
	expect(native.SetAttribute).toHaveBeenCalledWith("toy", 42);
	expect(native.SetAttribute).toHaveBeenCalledWith("useOnKeyDown", false);
	expect(native.RegisterForClicks).toHaveBeenCalledWith("AnyUp");
	combat = true;
	native.SetAttribute.mockClear();
	frame.setToy(43);
	expect(native.SetAttribute).not.toHaveBeenCalled();
	combat = false;
	frame.destroy();
	expect(native.SetAttribute).toHaveBeenCalledWith("toy", undefined);
	expect(native.SetAttribute).toHaveBeenCalledWith("type", undefined);
	expect(native.SetAttribute).toHaveBeenCalledWith("useOnKeyDown", undefined);
	expect(native.SetScript).toHaveBeenCalledWith("PostClick", undefined);
});

it("shows toy hover details and clears handlers on pooled icon release", () => {
	const scripts = new Map<string, (() => void) | undefined>();
	const tooltip = {
		SetOwner: vi.fn(),
		SetText: vi.fn(),
		SetPoint: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetFrameStrata: vi.fn(),
		ClearLines: vi.fn(),
		SetScale: vi.fn(),
		NineSlice: { SetAlpha: vi.fn() },
		TopOverlay: { SetAlpha: vi.fn() },
		BottomOverlay: { SetAlpha: vi.fn() },
		SetToyByItemID: vi.fn(),
		Show: vi.fn(),
		Hide: vi.fn(),
	};
	const native = {
		Hide: vi.fn(),
		SetScript: (script: string, callback?: () => void) =>
			scripts.set(script, callback),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	};
	const frame = new Frame(
		"toy-hover",
		new FramePoolManager({
			createFrame: (type) =>
				(type === "GameTooltip"
					? { ...native, ...tooltip }
					: native) as unknown as WowFrame,
		}),
	);
	let item: { toy: number } | undefined = { toy: 42 };
	frame.setHoverTooltip(() => item);
	scripts.get("OnEnter")?.();
	expect(tooltip.SetOwner).toHaveBeenCalledWith(native, "ANCHOR_RIGHT");
	expect(tooltip.SetToyByItemID).toHaveBeenCalledExactlyOnceWith(42);
	scripts.get("OnLeave")?.();
	expect(tooltip.Hide).toHaveBeenCalledTimes(2);
	frame.setHoverTooltip(() => ({ toy: 43 }));
	scripts.get("OnEnter")?.();
	expect(tooltip.SetToyByItemID).toHaveBeenLastCalledWith(43);
	scripts.get("OnHide")?.();
	expect(tooltip.Hide).toHaveBeenCalledTimes(3);
	item = undefined;
	frame.setHoverTooltip(() => item);
	scripts.get("OnEnter")?.();
	expect(tooltip.Show).toHaveBeenCalledTimes(2);
	frame.setHoverTooltip(() => ({ text: "Achievement", anchor: frame }));
	scripts.get("OnEnter")?.();
	expect(tooltip.SetOwner).toHaveBeenLastCalledWith(native, "ANCHOR_NONE");
	expect(tooltip.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		native,
		"TOPRIGHT",
		0,
		0,
	);
	frame.destroy();
	expect(scripts.get("OnEnter")).toBeUndefined();
	expect(scripts.get("OnLeave")).toBeUndefined();
	expect(scripts.get("OnHide")).toBeUndefined();
});

it("only updates changed labels and resets cached state and opacity on release", () => {
	const label = {
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetFont: vi.fn(),
		SetJustifyH: vi.fn(),
		SetWidth: vi.fn(),
		SetText: vi.fn(),
	};
	const native = {
		SetAlpha: vi.fn(),
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		SetScript: vi.fn(),
		CreateFontString: vi.fn(() => label),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	};
	const frame = new Frame(
		"cached-label",
		new FramePoolManager({ createFrame: () => native }),
	);
	frame.setLabel("value", "10");
	frame.setLabel("value", "10");
	frame.setLabel("value", "11");
	expect(label.SetPoint).toHaveBeenCalledOnce();
	expect(label.SetText.mock.calls).toEqual([["10"], ["11"]]);
	frame.setLabel("value", "11", "LEFT", 4);
	expect(label.SetPoint).toHaveBeenCalledTimes(2);
	expect(label.SetText).toHaveBeenCalledTimes(2);
	frame.setOpacity(0.35);
	expect(native.SetAlpha).toHaveBeenLastCalledWith(0.35);
	frame.destroy();
	expect(native.SetAlpha).toHaveBeenLastCalledWith(1);
	label.SetPoint.mockClear();
	label.SetText.mockClear();
	frame.setLabel("value", "11", "LEFT", 4);
	expect(label.SetPoint).toHaveBeenCalledOnce();
	expect(label.SetText).toHaveBeenCalledExactlyOnceWith("11");
});

it("draws and clears a gold focus border with a soft glow using reusable pooled decorations", () => {
	const decorations: { SetColorTexture: ReturnType<typeof vi.fn> }[] = [];
	const makeNative = () => ({
		Hide: vi.fn(),
		Show: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetPoint: vi.fn(),
		SetFrameLevel: vi.fn(),
		GetFrameLevel: () => 2,
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		CreateTexture: vi.fn(() => {
			const texture = {
				SetAllPoints: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetAtlas: vi.fn(),
				SetColorTexture: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetHeight: vi.fn(),
				SetWidth: vi.fn(),
			};
			decorations.push(texture);
			return texture;
		}),
	});
	const native = makeNative();
	const overlay = makeNative();
	const createFrame = vi
		.fn()
		.mockReturnValueOnce(native)
		.mockReturnValueOnce(overlay);
	const pool = new FramePoolManager({ createFrame });
	const frame = new Frame("container", pool);
	frame.setFocusBorder(true);
	expect(overlay.SetParent).toHaveBeenCalledWith(native);
	expect(overlay.SetFrameLevel).toHaveBeenLastCalledWith(12);
	const edges = decorations.slice(1);
	expect(edges).toHaveLength(12);
	expect(edges.at(0)?.SetColorTexture).toHaveBeenLastCalledWith(
		1,
		0.82,
		0,
		0.12,
	);
	expect(edges.at(-1)?.SetColorTexture).toHaveBeenLastCalledWith(1, 0.82, 0, 1);
	frame.setFocusBorder(false);
	for (const edge of edges)
		expect(edge.SetColorTexture).toHaveBeenLastCalledWith(1, 0.82, 0, 0);
	frame.setFocusBorder(true);
	expect(decorations).toHaveLength(13);
	expect(createFrame).toHaveBeenCalledTimes(2);
	frame.destroy();
	expect(overlay.SetFrameLevel).toHaveBeenLastCalledWith(0);
	for (const edge of edges)
		expect(edge.SetColorTexture).toHaveBeenLastCalledWith(0, 0, 0, 0);
});

it("renders complete instance tooltips, scales long content to fit and resets pooled tooltip state", () => {
	const native = {
		IsEmbedded: false,
		NineSlice: { SetAlpha: vi.fn() },
		TopOverlay: { SetAlpha: vi.fn() },
		BottomOverlay: { SetAlpha: vi.fn() },
		Hide: vi.fn(),
		Show: vi.fn(),
		SetOwner: vi.fn(),
		SetHyperlink: vi.fn(),
		ClearLines: vi.fn(),
		SetScale: vi.fn(),
		SetParent: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetScript: vi.fn(),
		GetWidth: () => 400,
		GetHeight: () => 1000,
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	};
	const factory = { createFrame: vi.fn(() => native) };
	const pool = new FramePoolManager(factory);
	const parent = new Frame("window", pool);
	const tooltip = new Frame("details", pool, "GameTooltip");
	expect(tooltip.showItemTooltip(parent, "item:42:bonus", 500, 500)).toEqual({
		width: 200,
		height: 500,
	});
	expect(native.SetOwner).toHaveBeenCalledWith(native, "ANCHOR_NONE");
	expect(native.SetHyperlink).toHaveBeenCalledWith("item:42:bonus");
	expect(native.IsEmbedded).toBe(true);
	for (const decoration of [
		native.NineSlice,
		native.TopOverlay,
		native.BottomOverlay,
	])
		expect(decoration.SetAlpha).toHaveBeenLastCalledWith(0);
	expect(native.SetScale).toHaveBeenLastCalledWith(0.5);
	expect(native.SetPoint).toHaveBeenLastCalledWith(
		"TOPLEFT",
		native,
		"TOPLEFT",
		40,
		-40,
	);
	tooltip.showItemTooltip(parent, 42, 500, 1200);
	expect(native.SetHyperlink).toHaveBeenLastCalledWith("item:42");
	expect(native.SetScale).toHaveBeenLastCalledWith(1);
	expect(factory.createFrame).toHaveBeenCalledTimes(2);
	tooltip.destroy();
	expect(native.ClearLines).toHaveBeenCalledTimes(3);
	expect(native.SetScale).toHaveBeenLastCalledWith(1);
	expect(pool.acquire("GameTooltip")).toBe(native);
	expect(native.IsEmbedded).toBe(false);
	for (const decoration of [
		native.NineSlice,
		native.TopOverlay,
		native.BottomOverlay,
	])
		expect(decoration.SetAlpha).toHaveBeenLastCalledWith(1);
});

it("retains the tooltip owner when first attaching to a hidden modal window", () => {
	let owner: WowFrame | undefined;
	let shown = false;
	const window = {
		Hide: vi.fn(),
		CreateTexture: () => ({ SetAllPoints: vi.fn() }),
	};
	const native = {
		IsEmbedded: false,
		NineSlice: { SetAlpha: vi.fn() },
		TopOverlay: { SetAlpha: vi.fn() },
		BottomOverlay: { SetAlpha: vi.fn() },
		Hide: () => {
			shown = false;
			owner = undefined;
		},
		Show: () => {
			shown = true;
		},
		SetOwner: (frame: WowFrame) => {
			owner = frame;
			shown = true;
		},
		// Reparenting a shown native tooltip under a hidden window invokes OnHide.
		SetParent: () => {
			if (shown) native.Hide();
		},
		SetHyperlink: vi.fn(),
		SetToyByItemID: vi.fn(),
		ClearLines: vi.fn(),
		SetScale: vi.fn(),
		SetFrameStrata: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		GetWidth: () => 200,
		GetHeight: () => 300,
		CreateTexture: () => ({ SetAllPoints: vi.fn() }),
	};
	const pool = new FramePoolManager({
		createFrame: (type) => (type === "GameTooltip" ? native : window),
	});
	const tooltip = new Frame("details", pool, "GameTooltip");
	tooltip.showItemTooltip(new Frame("window", pool), 42, 500, 500);
	expect(owner).toBe(window);
	expect(native.SetHyperlink).toHaveBeenCalledWith("item:42");
	native.SetHyperlink.mockClear();
	tooltip.showItemTooltip(new Frame("window", pool), { toy: 43 }, 500, 500);
	expect(native.SetToyByItemID).toHaveBeenCalledExactlyOnceWith(43);
	expect(native.SetHyperlink).not.toHaveBeenCalled();
});

it("scrolls focused ranges into view and clamps them to the scroll bounds", () => {
	let scroll = 0;
	const native = {
		Hide: vi.fn(),
		CreateTexture: () => ({ SetAllPoints: vi.fn() }),
		GetHeight: () => 100,
		GetVerticalScroll: () => scroll,
		GetVerticalScrollRange: () => 300,
		SetVerticalScroll: vi.fn((value: number) => {
			scroll = value;
		}),
	} as unknown as WowFrame;
	const frame = new Frame(
		"viewport",
		new FramePoolManager({ createFrame: () => native }),
		"ScrollFrame",
	);
	frame.revealVerticalRange(200, 242, 400);
	expect(scroll).toBe(142);
	frame.revealVerticalRange(20, 62, 400);
	expect(scroll).toBe(20);
	frame.revealVerticalRange(380, 422, 400);
	expect(scroll).toBe(300);
});

it("captures handled gamepad buttons, propagates others and resets input before pooling", () => {
	vi.stubGlobal("InCombatLockdown", () => false);
	const scripts = new Map<string, unknown>();
	const native = {
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		SetSize: vi.fn(),
		ClearAllPoints: vi.fn(),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
		EnableGamePadButton: vi.fn(),
		SetPropagateKeyboardInput: vi.fn(),
		SetFrameStrata: vi.fn(),
		SetFrameLevel: vi.fn(),
		SetScript: (script: string, handler?: unknown) =>
			scripts.set(script, handler),
	};
	const frame = new Frame(
		"controller",
		new FramePoolManager({ createFrame: () => native }),
	);
	const released = vi.fn();
	const onButtonDown = vi.fn((button: string) => button === "PADDUP");
	frame.setGamePadInput(onButtonDown, released, {
		buttons: ["PADDUP"],
		delaySeconds: 0.5,
		intervalSeconds: 0.05,
	});
	const buttonScript = scripts.get("OnGamePadButtonDown") as
		| ((frame: unknown, button: string) => void)
		| undefined;
	const updateScript = scripts.get("OnUpdate") as
		| ((frame: unknown, elapsed: number) => void)
		| undefined;
	const releaseScript = scripts.get("OnGamePadButtonUp") as
		| ((frame: unknown, button: string) => void)
		| undefined;
	buttonScript?.(native, "PADDUP");
	expect(native.SetPropagateKeyboardInput).toHaveBeenLastCalledWith(false);
	buttonScript?.(native, "PADDUP");
	buttonScript?.(native, "PAD2");
	expect(native.SetPropagateKeyboardInput).toHaveBeenLastCalledWith(true);
	expect(onButtonDown).toHaveBeenCalledTimes(2);
	updateScript?.(native, 0.49);
	expect(onButtonDown).toHaveBeenCalledTimes(2);
	updateScript?.(native, 0.01);
	expect(onButtonDown).toHaveBeenCalledTimes(3);
	updateScript?.(native, 0.05);
	expect(onButtonDown).toHaveBeenCalledTimes(4);
	releaseScript?.(native, "PADDUP");
	expect(released).toHaveBeenCalledOnce();
	updateScript?.(native, 1);
	expect(onButtonDown).toHaveBeenCalledTimes(4);
	frame.destroy();
	expect(native.EnableGamePadButton).toHaveBeenLastCalledWith(false);
	expect(scripts.get("OnGamePadButtonDown")).toBeUndefined();
	expect(scripts.get("OnGamePadButtonUp")).toBeUndefined();
	expect(scripts.get("OnUpdate")).toBeUndefined();
	expect(native.SetFrameLevel).toHaveBeenLastCalledWith(0);
	expect(native.SetFrameStrata).toHaveBeenLastCalledWith("PARENT");
});

it("registers Escape closing once and removes its handler and global alias before pooled reuse", () => {
	const globals: Record<string, unknown> = {};
	const specialFrames: string[] = [];
	vi.stubGlobal("_G", globals);
	vi.stubGlobal("UISpecialFrames", specialFrames);
	const scripts = new Map<string, (() => void) | undefined>();
	const native = {
		Hide: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		SetScript: (script: string, handler?: () => void) =>
			scripts.set(script, handler),
		CreateTexture: () => ({
			SetAllPoints: vi.fn(),
			SetTexture: vi.fn(),
			SetTexCoord: vi.fn(),
			SetAtlas: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetPoint: vi.fn(),
			SetWidth: vi.fn(),
			SetHeight: vi.fn(),
			SetColorTexture: vi.fn(),
		}),
	} as unknown as WowFrame;
	const pool = new FramePoolManager({ createFrame: () => native });
	const frame = new Frame("escape-test", pool);
	const close = vi.fn();
	frame.onClose(close);
	frame.onClose(close);
	expect(specialFrames).toHaveLength(1);
	expect(globals[specialFrames.at(0) ?? ""]).toBe(native);
	scripts.get("OnHide")?.();
	expect(close).toHaveBeenCalledOnce();
	frame.destroy();
	expect(specialFrames).toEqual([]);
	expect(Object.values(globals).filter((value) => value !== undefined)).toEqual(
		[],
	);
	expect(scripts.get("OnHide")).toBeUndefined();
	expect(pool.acquire("Frame")).toBe(native);
});

it("configures secure spells through the global combat guard and leaves attributes unchanged in combat", () => {
	const combat = vi.fn(() => false);
	vi.stubGlobal("InCombatLockdown", combat);
	vi.stubGlobal("C_RestrictedActions", {});
	const native = {
		Hide: vi.fn(),
		RegisterForClicks: vi.fn(),
		SetAttribute: vi.fn(),
		CreateTexture: () => ({ SetAllPoints: vi.fn() }),
	} as unknown as WowFrame & { SetAttribute: ReturnType<typeof vi.fn> };
	const frame = new Frame(
		"spell",
		new FramePoolManager({ createFrame: () => native }),
		"SecureButton",
	);
	frame.setSpell(259740);
	expect(native.SetAttribute.mock.calls).toEqual([
		["type", "spell"],
		["spell", 259740],
	]);
	combat.mockReturnValue(true);
	frame.setSpell(150544);
	expect(native.SetAttribute).toHaveBeenCalledTimes(2);
	combat.mockReturnValue(false);
	frame.setSpell();
	expect(native.SetAttribute).toHaveBeenLastCalledWith("spell", undefined);
});

it("crops the baked icon rim and restores full texture coordinates for pooled reuse", () => {
	const texture = {
		SetAllPoints: vi.fn(),
		SetTexture: vi.fn(),
		SetAtlas: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetWidth: vi.fn(),
		SetHeight: vi.fn(),
		SetColorTexture: vi.fn(),
		SetTexCoord: vi.fn(),
	};
	const native = {
		Hide: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetSize: vi.fn(),
		SetParent: vi.fn(),
		SetScript: vi.fn(),
		CreateTexture: () => texture,
	} as unknown as WowFrame;
	const pool = new FramePoolManager({ createFrame: () => native });
	const frame = new Frame("icon", pool);
	frame.setIcon(133633);
	expect(texture.SetTexture).toHaveBeenCalledWith(133633);
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0.07, 0.93, 0.07, 0.93);
	frame.setIcon(
		"Interface\\AddOns\\SteamDeckUI\\assets\\Target_Wide_Enemy.png",
		false,
	);
	expect(texture.SetTexture).toHaveBeenLastCalledWith(
		"Interface\\AddOns\\SteamDeckUI\\assets\\Target_Wide_Enemy.png",
	);
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
	frame.destroy();
	expect(texture.SetTexCoord).toHaveBeenLastCalledWith(0, 1, 0, 1);
});

it.each(["left", "right", "fullscreen"] as const)(
	"raises the %s dock above ordinary UI and resets it for reuse",
	(position) => {
		const native = {
			Hide: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetSize: vi.fn(),
			SetPoint: vi.fn(),
			SetParent: vi.fn(),
			SetFrameStrata: vi.fn(),
			SetScript: vi.fn(),
			CreateTexture: () => ({
				SetAllPoints: vi.fn(),
				SetTexture: vi.fn(),
				SetTexCoord: vi.fn(),
				SetAtlas: vi.fn(),
				ClearAllPoints: vi.fn(),
				SetPoint: vi.fn(),
				SetWidth: vi.fn(),
				SetHeight: vi.fn(),
				SetColorTexture: vi.fn(),
			}),
		} as unknown as WowFrame;
		const pool = new FramePoolManager({ createFrame: () => native });
		const frame = new Frame("dock", pool);
		frame.dock(position, 500);
		expect(native.SetFrameStrata).toHaveBeenLastCalledWith("DIALOG");
		frame.destroy();
		expect(native.SetFrameStrata).toHaveBeenLastCalledWith("PARENT");
		expect(pool.acquire("Frame")).toBe(native);
	},
);
