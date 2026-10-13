import type { WowFrame } from "../../types";
import type { IFrameSuppression } from "../../ui/components/frame-suppression";

export class BuiltInBank {
	constructor(private readonly frames: IFrameSuppression) {}
	disable(): void {
		const native = (_G as unknown as Record<string, unknown>).BankFrame as
			| (WowFrame & { GetParent(): WowFrame | undefined })
			| undefined;
		if (native) this.frames.suppress([native]);
	}
	restore(): void {
		this.frames.restore();
	}
}
