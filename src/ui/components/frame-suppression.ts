import type { WowFrame } from "../../types";
import type { IFramePoolManager } from "../frame-pool-manager";

export interface IFrameSuppression {
	suppress(
		frames: readonly (WowFrame & { GetParent(): WowFrame | undefined })[],
	): void;
	restore(): void;
}
/** Hides existing frames without changing their logical shown state. */
export class FrameSuppression implements IFrameSuppression {
	private parent?: WowFrame;
	private readonly originalParents = new Map<WowFrame, WowFrame | undefined>();
	constructor(private readonly pool: IFramePoolManager) {}
	suppress(
		frames: readonly (WowFrame & { GetParent(): WowFrame | undefined })[],
	): void {
		if (this.parent) return;
		this.parent = this.pool.acquire("Frame");
		this.parent.Hide();
		for (const frame of frames) {
			this.originalParents.set(frame, frame.GetParent());
			frame.SetParent(this.parent);
		}
	}
	restore(): void {
		if (!this.parent) return;
		for (const [frame, parent] of this.originalParents) frame.SetParent(parent);
		this.originalParents.clear();
		this.pool.release("Frame", this.parent);
		this.parent = undefined;
	}
}
