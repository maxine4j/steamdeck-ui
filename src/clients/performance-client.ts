import type { Diagnostics, WorkProgress } from "./diagnostics";

export interface IPerformanceClient {
	now(): number;
	log(message: string): void;
	work?(progress: WorkProgress): void;
}
export const quietPerformance: IPerformanceClient = {
	now: () => 0,
	log: () => {},
};

/** Central diagnostics with local chat fallback; never resets the profiler. */
export class PerformanceClient implements IPerformanceClient {
	private reporting = false;
	constructor(private readonly diagnostics?: Diagnostics) {}
	now(): number {
		try {
			return debugprofilestop();
		} catch {
			return 0;
		}
	}
	log(message: string): void {
		this.report(() => {
			if (this.diagnostics) this.diagnostics.log("info", message);
			else print(`[SteamDeckUI performance] ${message}`);
		});
	}
	work(progress: WorkProgress): void {
		this.report(() => this.diagnostics?.work(progress));
	}
	private report(write: () => void): void {
		if (this.reporting) return;
		this.reporting = true;
		try {
			write();
		} catch {
			// Instrumentation must never replace the failure being measured.
		} finally {
			this.reporting = false;
		}
	}
}

let nextWorkId = 0;
export class WorkMeasurement {
	private finished = false;
	private readonly id = ++nextWorkId;
	private completed = 0;
	private total = 0;
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
		this.progress(0, 0);
	}
	progress(completed: number, total: number, state = "running"): void {
		this.completed = completed;
		this.total = total;
		this.performance.work?.({
			id: this.id,
			label: this.label,
			reason: this.reason,
			completed,
			total,
			state,
			elapsed: this.performance.now() - this.started,
		});
	}
	measure<T>(stage: string, work: () => T): T {
		const start = this.performance.now();
		try {
			return work();
		} catch (error) {
			this.finish("failed");
			throw error;
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
		if (this.finished) return;
		this.finished = true;
		this.progress(
			this.completed,
			this.total,
			result.split(" ").at(0) ?? result,
		);
		const stages = [...this.timings]
			.map(([stage, milliseconds]) => `${stage}=${milliseconds.toFixed(2)}ms`)
			.join(" ");
		this.performance.log(
			`${this.label} ${result} reason=${this.reason} pages=${this.pages} elapsed=${(this.performance.now() - this.started).toFixed(2)}ms ${stages} maxPage=${this.maxPage.toFixed(2)}ms`,
		);
	}
}
