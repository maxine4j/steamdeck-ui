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
	private updating = false;
	constructor(
		private readonly clock: () => number,
		private readonly limit = 500,
		private readonly persist?: (line: string) => void,
		private readonly context = "",
	) {}
	now(): number {
		try {
			return this.clock();
		} catch {
			return 0;
		}
	}
	log(level: "info" | "error", message: string): void {
		if (this.updating) return;
		this.updating = true;
		try {
			const line = `[${this.now()}] ${level.toUpperCase()} ${this.context.length > 0 ? `${this.context} ` : ""}${message.slice(0, 12000)}`;
			try {
				this.persist?.(line);
			} catch {
				/* Preserve the live buffer even if saving fails. */
			}
			this.lines.push(line);
			while (
				this.lines.length > this.limit ||
				this.lines.join("\n").length > 120000
			)
				this.lines.shift();
			this.notify("log");
		} catch {
			// Logging must never raise another error. TSTL compiles this to pcall.
		} finally {
			this.updating = false;
		}
	}
	work(progress: WorkProgress): void {
		if (this.updating) return;
		this.updating = true;
		try {
			this.workItems.set(progress.id, progress);
			// Keep active jobs and a bounded history of recent completed jobs.
			const finished = [...this.workItems.values()].filter(
				(job) => job.state !== "running",
			);
			for (const job of finished.slice(0, Math.max(0, finished.length - 30)))
				this.workItems.delete(job.id);
			this.notify("work");
		} catch {
			// Work diagnostics share the same non-recursive failure boundary.
		} finally {
			this.updating = false;
		}
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
		for (const observer of [...this.observers]) {
			try {
				observer(kind);
			} catch {
				/* A broken panel must not block other observers. */
			}
		}
	}
}
