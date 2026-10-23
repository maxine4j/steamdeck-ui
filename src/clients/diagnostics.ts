export interface WorkProgress {
	readonly id: number;
	readonly label: string;
	readonly reason: string;
	readonly completed: number;
	readonly total: number;
	readonly state: string;
	readonly elapsed: number;
}

/** Bounded session diagnostics; contains no game or presentation dependencies. */
export class Diagnostics {
	private readonly lines: string[] = [];
	private readonly workItems = new Map<number, WorkProgress>();
	private readonly observers = new Set<(kind: "log" | "work") => void>();
	constructor(
		private readonly clock: () => number,
		private readonly limit = 500,
		private readonly persist?: (line: string) => void,
		private readonly context = "",
	) {}
	now(): number {
		return this.clock();
	}
	log(level: "info" | "error", message: string): void {
		const line = `[${this.now()}] ${level.toUpperCase()} ${this.context.length > 0 ? `${this.context} ` : ""}${message.slice(0, 12000)}`;
		this.persist?.(line);
		this.lines.push(line);
		while (
			this.lines.length > this.limit ||
			this.lines.join("\n").length > 120000
		)
			this.lines.shift();
		this.notify("log");
	}
	work(progress: WorkProgress): void {
		this.workItems.set(progress.id, progress);
		// Keep active jobs and a bounded history of recent completed jobs.
		const finished = [...this.workItems.values()].filter(
			(job) => job.state !== "running",
		);
		for (const job of finished.slice(0, Math.max(0, finished.length - 30)))
			this.workItems.delete(job.id);
		this.notify("work");
	}
	jobs(): readonly WorkProgress[] {
		return [...this.workItems.values()];
	}
	report(): string {
		return this.lines.join("\n");
	}
	subscribe(changed: (kind: "log" | "work") => void): () => void {
		this.observers.add(changed);
		return () => {
			this.observers.delete(changed);
		};
	}
	private notify(kind: "log" | "work"): void {
		for (const observer of [...this.observers]) observer(kind);
	}
}
