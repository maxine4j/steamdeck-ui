import { expect, it, vi } from "vitest";
import type { WowFrame } from "../../types";
import { FramePoolManager } from "../frame-pool-manager";
import { Frame } from "./frame";

it("keeps a raised pulsing icon outline bright over dimmed content and resets it for reuse", () => {
	const alpha = {
		SetFromAlpha: vi.fn(),
		SetToAlpha: vi.fn(),
		SetDuration: vi.fn(),
		SetSmoothing: vi.fn(),
	};
	let playing = false;
	const animation = {
		CreateAnimation: vi.fn(() => alpha),
		SetLooping: vi.fn(),
		IsPlaying: () => playing,
		Play: vi.fn(() => {
			playing = true;
		}),
		Stop: vi.fn(() => {
			playing = false;
		}),
	};
	const textures: {
		SetColorTexture: ReturnType<typeof vi.fn>;
		SetAlpha: ReturnType<typeof vi.fn>;
	}[] = [];
	const natives: ReturnType<typeof create>[] = [];
	function create() {
		let opacity = 1;
		let ignoresParentAlpha = false;
		let parent: ReturnType<typeof create> | undefined;
		return {
			Hide: vi.fn(),
			Show: vi.fn(),
			ClearAllPoints: vi.fn(),
			SetSize: vi.fn(),
			SetParent: vi.fn((value?: ReturnType<typeof create>) => {
				parent = value;
			}),
			SetAlpha: vi.fn((value: number) => {
				opacity = value;
			}),
			SetIgnoreParentAlpha: vi.fn((value: boolean) => {
				ignoresParentAlpha = value;
			}),
			GetEffectiveAlpha: (): number =>
				opacity * (ignoresParentAlpha ? 1 : (parent?.GetEffectiveAlpha() ?? 1)),
			SetPoint: vi.fn(),
			GetFrameLevel: () => 5,
			SetFrameLevel: vi.fn(),
			SetScript: vi.fn(),
			RegisterForClicks: vi.fn(),
			RegisterForDrag: vi.fn(),
			CreateTexture: vi.fn(() => {
				const texture = {
					SetAllPoints: vi.fn(),
					ClearAllPoints: vi.fn(),
					SetPoint: vi.fn(),
					SetTexture: vi.fn(),
					SetTexCoord: vi.fn(),
					SetColorTexture: vi.fn(),
					SetHeight: vi.fn(),
					SetWidth: vi.fn(),
					SetBlendMode: vi.fn(),
					SetVertexColor: vi.fn(),
					SetAlpha: vi.fn(),
					CreateAnimationGroup: () => animation,
				};
				textures.push(texture);
				return texture;
			}),
		};
	}
	const factory = vi.fn(() => {
		const native = create();
		natives.push(native);
		return native as unknown as WowFrame;
	});
	const pool = new FramePoolManager({ createFrame: factory });
	const icon = new Frame("icon", pool, "Button");
	icon.setOpacity(0.2);
	icon.setFocused(true, true);
	expect(natives).toHaveLength(3);
	const outline = natives.at(1);
	expect(natives.at(0)?.GetEffectiveAlpha()).toBe(0.2);
	expect(outline?.GetEffectiveAlpha()).toBe(1);
	icon.setOpacity(1);
	expect(outline?.GetEffectiveAlpha()).toBe(1);
	icon.setOpacity(0.2);
	expect(outline?.GetEffectiveAlpha()).toBe(1);
	expect(outline?.SetFrameLevel).toHaveBeenLastCalledWith(15);
	expect(outline?.SetPoint).toHaveBeenCalledWith(
		"TOPLEFT",
		natives.at(0),
		"TOPLEFT",
		-2,
		2,
	);
	expect(outline?.SetPoint).toHaveBeenCalledWith(
		"BOTTOMRIGHT",
		natives.at(0),
		"BOTTOMRIGHT",
		2,
		-2,
	);
	expect(animation.SetLooping).toHaveBeenCalledWith("BOUNCE");
	expect(textures.at(-1)?.SetAlpha).toHaveBeenLastCalledWith(1);
	expect(alpha.SetFromAlpha).toHaveBeenCalledWith(0.45);
	expect(alpha.SetToAlpha).toHaveBeenCalledWith(1);
	expect(alpha.SetDuration).toHaveBeenCalledWith(1.2);
	expect(animation.Play).toHaveBeenCalledOnce();
	icon.setFocused(true, true);
	expect(animation.Play).toHaveBeenCalledOnce();
	expect(factory).toHaveBeenCalledTimes(3);
	icon.setFocused(false, true);
	expect(animation.Stop).toHaveBeenCalledOnce();
	expect(outline?.Hide).toHaveBeenCalled();
	icon.setFocused(true, true);
	icon.hide();
	expect(playing).toBe(false);
	icon.setFocused(true, true);
	icon.destroy();
	expect(playing).toBe(false);
	expect(outline?.SetFrameLevel).toHaveBeenLastCalledWith(0);
	const reused = pool.acquire("Frame");
	expect(reused).toBe(outline);
	reused.SetParent(natives.at(0) as unknown as WowFrame);
	natives.at(0)?.SetAlpha(0.2);
	expect(outline?.GetEffectiveAlpha()).toBe(0.2);
	expect(
		textures.every(
			(texture) => texture.SetColorTexture.mock.lastCall?.at(3) === 0,
		),
	).toBe(true);
});
