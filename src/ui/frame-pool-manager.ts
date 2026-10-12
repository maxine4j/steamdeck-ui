import type { WowFrame, WowTexture } from "../types";
export type FrameType =
	| "Frame"
	| "Button"
	| "SecureButton"
	| "SecureStateButton"
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
}
export class FramePoolManager implements IFramePoolManager {
	private readonly available = new Map<FrameType, WowFrame[]>();
	private readonly backgrounds = new Map<WowFrame, WowTexture>();
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
	release(type: FrameType, frame: WowFrame): void {
		if (this.leased.get(frame) !== type) return;
		frame.Hide();
		this.backgrounds.get(frame)?.SetTexture(undefined);
		this.backgrounds.get(frame)?.SetTexCoord(0, 1, 0, 1);
		this.backgrounds.get(frame)?.SetColorTexture(0, 0, 0, 0);
		frame.ClearAllPoints();
		frame.SetSize(0, 0);
		frame.SetParent(undefined);
		this.leased.delete(frame);
		const frames = this.available.get(type) ?? [];
		frames.push(frame);
		this.available.set(type, frames);
	}
}
