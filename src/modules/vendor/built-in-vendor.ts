import type { WowFrame } from "../../types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export interface IBuiltInVendor {
	disable(): void;
	restore(): void;
}

/** Preserve Blizzard's logical merchant state and confirmation handlers. */
export class BuiltInVendor implements IBuiltInVendor {
	constructor(private readonly frames: IFrameSuppression) {}
	disable(): void {
		const native = (_G as unknown as Record<string, unknown>).MerchantFrame as
			| (WowFrame & { GetParent(): WowFrame | undefined })
			| undefined;
		if (native) this.frames.suppress([native]);
	}
	restore(): void {
		this.frames.restore();
	}
}
