import type { WowFrame, WowLine, WowTexture } from "../types";

type MaskableTexture = WowTexture & {
	AddMaskTexture(mask: WowTexture): void;
	RemoveMaskTexture(mask: WowTexture): void;
};
export type FrameType =
	| "FilterDropdown"
	| "FocusTimer"
	| "GameTooltip"
	| "ShoppingTooltip"
	| "Frame"
	| "SecureFrame"
	| "Button"
	| "SecureButton"
	| "SecureStateButton"
	| "SecureRingButton"
	| "Cooldown"
	| "EditBox"
	| "StatusBar"
	| "ScrollFrame"
	| "PlayerModel";
export interface FrameFactory {
	createFrame(type: FrameType): WowFrame;
}
export interface IFramePoolManager {
	acquire(type: FrameType): WowFrame;
	release(type: FrameType, frame: WowFrame): void;
	getBackground(frame: WowFrame): WowTexture;
	setBackgroundMask(
		frame: WowFrame,
		atlas: string | undefined,
		outset?: number,
	): void;
	getDecoration(frame: WowFrame, key: string): WowTexture;
	getLine(
		frame: WowFrame,
		key: string,
		layer?: "ARTWORK" | "BACKGROUND",
	): WowLine;
}
export class FramePoolManager implements IFramePoolManager {
	private readonly available = new Map<FrameType, WowFrame[]>();
	private readonly backgrounds = new Map<WowFrame, WowTexture>();
	private readonly backgroundMasks = new Map<WowFrame, WowTexture>();
	private readonly maskedBackgrounds = new Set<WowFrame>();
	private readonly decorations = new Map<WowFrame, Map<string, WowTexture>>();
	private readonly lines = new Map<WowFrame, Map<string, WowLine>>();
	private readonly leased = new Map<WowFrame, FrameType>();
	constructor(private readonly factory: FrameFactory) {}
	acquire(type: FrameType): WowFrame {
		const frame =
			this.available.get(type)?.pop() ?? this.factory.createFrame(type);
		frame.Hide();
		this.leased.set(frame, type);
		return frame;
	}
	getBackground(frame: WowFrame): WowTexture {
		let texture = this.backgrounds.get(frame);
		if (!texture) {
			texture = frame.CreateTexture(undefined, "BACKGROUND");
			texture.SetAllPoints();
			this.backgrounds.set(frame, texture);
		}
		return texture;
	}
	getDecoration(frame: WowFrame, key: string): WowTexture {
		let decorations = this.decorations.get(frame);
		if (!decorations) {
			decorations = new Map<string, WowTexture>();
			this.decorations.set(frame, decorations);
		}
		let texture = decorations.get(key);
		if (!texture) {
			texture = frame.CreateTexture(
				undefined,
				key.startsWith("button-") ? "BACKGROUND" : "OVERLAY",
			);
			decorations.set(key, texture);
		}
		return texture;
	}
	setBackgroundMask(
		frame: WowFrame,
		atlas: string | undefined,
		outset = 0,
	): void {
		let mask = this.backgroundMasks.get(frame);
		if (atlas === undefined) {
			if (mask && this.maskedBackgrounds.delete(frame))
				(this.getBackground(frame) as MaskableTexture).RemoveMaskTexture(mask);
			return;
		}
		if (!mask) {
			mask = (
				frame as WowFrame & {
					CreateMaskTexture(name?: string, layer?: string): WowTexture;
				}
			).CreateMaskTexture(undefined, "BACKGROUND");
			this.backgroundMasks.set(frame, mask);
		}
		mask.ClearAllPoints();
		mask.SetAllPoints(this.getBackground(frame));
		if (outset !== 0) {
			const background = this.getBackground(frame);
			mask.SetPoint("TOPLEFT", background, "TOPLEFT", -outset, outset);
			mask.SetPoint("BOTTOMRIGHT", background, "BOTTOMRIGHT", outset, -outset);
		}
		mask.SetAtlas(atlas, false);
		if (!this.maskedBackgrounds.has(frame)) {
			(this.getBackground(frame) as MaskableTexture).AddMaskTexture(mask);
			this.maskedBackgrounds.add(frame);
		}
	}
	getLine(
		frame: WowFrame,
		key: string,
		layer: "ARTWORK" | "BACKGROUND" = "ARTWORK",
	): WowLine {
		let lines = this.lines.get(frame);
		if (!lines) {
			lines = new Map<string, WowLine>();
			this.lines.set(frame, lines);
		}
		let line = lines.get(key);
		if (!line) {
			line = frame.CreateLine(undefined, layer);
			line.Hide();
			lines.set(key, line);
		}
		return line;
	}
	release(type: FrameType, frame: WowFrame): void {
		if (this.leased.get(frame) !== type) return;
		frame.Hide();
		const mask = this.backgroundMasks.get(frame);
		if (mask && this.maskedBackgrounds.delete(frame))
			(this.getBackground(frame) as MaskableTexture).RemoveMaskTexture(mask);
		this.backgrounds.get(frame)?.SetTexture(undefined);
		this.backgrounds.get(frame)?.SetTexCoord(0, 1, 0, 1);
		this.backgrounds.get(frame)?.SetColorTexture(0, 0, 0, 0);
		this.backgrounds.get(frame)?.ClearAllPoints();
		this.backgrounds.get(frame)?.SetAllPoints();
		for (const decoration of this.decorations.get(frame)?.values() ?? []) {
			decoration.SetTexture(undefined);
			decoration.SetTexCoord(0, 1, 0, 1);
			decoration.SetColorTexture(0, 0, 0, 0);
			decoration.ClearAllPoints();
		}
		for (const line of this.lines.get(frame)?.values() ?? []) {
			line.Hide();
			line.ClearAllPoints();
			line.SetColorTexture(0, 0, 0, 0);
			line.SetThickness(1);
		}
		frame.ClearAllPoints();
		frame.SetSize(0, 0);
		frame.SetParent(undefined);
		this.leased.delete(frame);
		const frames = this.available.get(type) ?? [];
		frames.push(frame);
		this.available.set(type, frames);
	}
}
