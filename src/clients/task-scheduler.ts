export interface ITaskScheduler {
	nextFrame(callback: () => void): () => void;
	delay(seconds: number, callback: () => void): () => void;
}

/** Cooperative scheduling: each callback still runs on WoW's UI thread. */
export class TaskScheduler implements ITaskScheduler {
	nextFrame(callback: () => void): () => void {
		return this.delay(0, callback);
	}
	delay(seconds: number, callback: () => void): () => void {
		let cancelled = false;
		// The generated API incorrectly annotates the callback as a number.
		const after = C_Timer.After as unknown as (
			this: void,
			seconds: number,
			callback: (this: void) => void,
		) => void;
		after(seconds, () => {
			if (!cancelled) callback();
		});
		return () => {
			cancelled = true;
		};
	}
}
