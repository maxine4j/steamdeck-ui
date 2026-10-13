import type { WowFrame, WowTexture } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";
import { setBorder } from "./border";

interface AlphaAnimation {
	SetFromAlpha(alpha: number): void;
	SetToAlpha(alpha: number): void;
	SetDuration(seconds: number): void;
	SetSmoothing(mode: "IN_OUT"): void;
}
interface GlowAnimation {
	CreateAnimation(type: "Alpha"): AlphaAnimation;
	SetLooping(mode: "BOUNCE"): void;
	IsPlaying(): boolean;
	Play(): void;
	Stop(): void;
}
type GlowTexture = WowTexture & {
	SetBlendMode(mode: "ADD" | "BLEND"): void;
	SetVertexColor(red: number, green: number, blue: number): void;
	SetAlpha(alpha: number): void;
	CreateAnimationGroup(): GlowAnimation;
};
type OutlineFrame = WowFrame & { SetFrameLevel(level: number): void };

/** A raised icon outline with an independently pulsing glow. */
export class IconFocus {
	private readonly outline: OutlineFrame;
	private readonly glow: GlowTexture;
	private readonly animation: GlowAnimation;
	constructor(
		private readonly pool: IFramePoolManager,
		private readonly owner: WowFrame,
	) {
		this.outline = pool.acquire("Frame") as OutlineFrame;
		this.outline.SetParent(owner);
		this.outline.SetPoint("TOPLEFT", owner, "TOPLEFT", -2, 2);
		this.outline.SetPoint("BOTTOMRIGHT", owner, "BOTTOMRIGHT", 2, -2);
		setBorder(pool, this.outline, [1, 0.82, 0, 1], 2, "icon-focus");
		this.glow = pool.getDecoration(
			this.outline,
			"icon-focus-glow",
		) as GlowTexture;
		this.glow.ClearAllPoints();
		this.glow.SetPoint("TOPLEFT", this.outline, "TOPLEFT", -12, 12);
		this.glow.SetPoint("BOTTOMRIGHT", this.outline, "BOTTOMRIGHT", 12, -12);
		this.glow.SetTexture("Interface\\Buttons\\UI-ActionButton-Border");
		this.glow.SetBlendMode("ADD");
		this.glow.SetVertexColor(1, 0.82, 0);
		this.glow.SetAlpha(1);
		this.animation = this.glow.CreateAnimationGroup();
		const pulse = this.animation.CreateAnimation("Alpha");
		pulse.SetFromAlpha(0.45);
		pulse.SetToAlpha(1);
		pulse.SetDuration(1.2);
		pulse.SetSmoothing("IN_OUT");
		this.animation.SetLooping("BOUNCE");
	}
	setFocused(focused: boolean): void {
		if (!focused) {
			this.animation.Stop();
			this.outline.Hide();
			return;
		}
		this.outline.SetFrameLevel(
			(this.owner as WowFrame & { GetFrameLevel(): number }).GetFrameLevel() +
				10,
		);
		this.outline.Show();
		if (!this.animation.IsPlaying()) this.animation.Play();
	}
	destroy(): void {
		this.setFocused(false);
		this.glow.SetAlpha(1);
		this.glow.SetVertexColor(1, 1, 1);
		this.glow.SetBlendMode("BLEND");
		this.outline.SetFrameLevel(0);
		this.pool.release("Frame", this.outline);
	}
}
