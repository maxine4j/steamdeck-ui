import type { ITaskScheduler } from "../../clients/task-scheduler";

export class DebouncedInput {
	private cancelPending?: () => void;
	private queuedText?: string;
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly changed: (text: string) => void,
	) {}
	change(text: string): void {
		this.cancel();
		this.queuedText = text;
		this.cancelPending = this.scheduler.delay(0.3, () => {
			this.cancelPending = undefined;
			this.queuedText = undefined;
			this.changed(text);
		});
	}
	cancel(): void {
		this.cancelPending?.();
		this.cancelPending = undefined;
	}
	resume(): void {
		if (this.queuedText !== undefined) this.change(this.queuedText);
	}
}
