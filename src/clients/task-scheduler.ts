export interface ITaskScheduler {
	nextFrame(callback: () => void): () => void;
}

/** Cooperative scheduling: each callback still runs on WoW's UI thread. */
export class TaskScheduler implements ITaskScheduler {
	nextFrame(callback: () => void): () => void {
		let cancelled = false;
		// The generated API incorrectly annotates the callback as a number.
		const after = C_Timer.After as unknown as (
			this: void,
			seconds: number,
			callback: (this: void) => void,
		) => void;
		after(0, () => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	}
}
