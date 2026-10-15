export interface IPerformanceClient {
	now(): number;
	log(message: string): void;
}
export const quietPerformance: IPerformanceClient = {
	now: () => 0,
	log: () => {},
};

/** Local WoW chat output only; never uses a chat transport or resets the profiler. */
export class PerformanceClient implements IPerformanceClient {
	now(): number {
		return debugprofilestop();
	}
	log(message: string): void {
		print(`[SteamDeckUI performance] ${message}`);
	}
}

export class WorkMeasurement {
	private readonly started: number;
	private readonly timings = new Map<string, number>();
	private pages = 0;
	private maxPage = 0;
	constructor(
		private readonly performance: IPerformanceClient,
		private readonly label: string,
		private readonly reason: string,
	) {
		this.started = performance.now();
		performance.log(`${label} start reason=${reason}`);
	}
	measure<T>(stage: string, work: () => T): T {
		const start = this.performance.now();
		try {
			return work();
		} finally {
			this.add(stage, this.performance.now() - start);
		}
	}
	add(stage: string, milliseconds: number): void {
		this.timings.set(stage, (this.timings.get(stage) ?? 0) + milliseconds);
	}
	page(start: number): void {
		this.pages++;
		this.maxPage = Math.max(this.maxPage, this.performance.now() - start);
	}
	finish(result: string): void {
		const stages = [...this.timings]
			.map(([stage, milliseconds]) => `${stage}=${milliseconds.toFixed(2)}ms`)
			.join(" ");
		this.performance.log(
			`${this.label} ${result} reason=${this.reason} pages=${this.pages} elapsed=${(this.performance.now() - this.started).toFixed(2)}ms ${stages} maxPage=${this.maxPage.toFixed(2)}ms`,
		);
	}
}
