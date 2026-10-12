import type { ITaskScheduler } from "../clients/task-scheduler";

/** Coalesces visible refreshes and remembers invalidation while hidden. */
export class DeferredRefresh {
	private active = false;
	private dirty = true;
	private cancel?: () => void;
	constructor(
		private readonly scheduler: ITaskScheduler,
		private readonly update: () => void,
	) {}
	invalidate(): void {
		this.dirty = true;
		this.schedule();
	}
	setActive(active: boolean): void {
		this.active = active;
		if (active) this.schedule();
		else {
			this.cancel?.();
			this.cancel = undefined;
		}
	}
	private schedule(): void {
		if (!this.active || !this.dirty || this.cancel) return;
		this.cancel = this.scheduler.nextFrame(() => {
			this.cancel = undefined;
			this.dirty = false;
			this.update();
		});
	}
}
