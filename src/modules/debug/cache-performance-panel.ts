import type { CacheStats } from "../../clients/collection-cache";
import type { Diagnostics } from "../../clients/diagnostics";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import { type ListRow, ScrollList } from "../../ui/components/scroll-list";
import type { IUIComponent } from "../../ui/components/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IPanel } from "../../ui/panel/types";

export class CachePerformancePanel implements IPanel {
	readonly id = "debug-cache";
	readonly title = "Cache performance";
	readonly icon = 136243;
	private readonly list: ScrollList;
	private mounted = false;
	private cancel?: () => void;
	private changed?: () => void;
	constructor(
		pool: IFramePoolManager,
		private readonly diagnostics: Diagnostics,
		private readonly stats: () => readonly CacheStats[],
		private readonly scheduler: Pick<ITaskScheduler, "delay">,
		close: () => void,
	) {
		this.list = new ScrollList("debug-cache-list", pool, this.title, close, {
			padding: 16,
			onChanged: (complete) => {
				if (complete) this.changed?.();
			},
		});
	}
	private refresh(): void {
		const caches = this.stats();
		const jobs = [...this.diagnostics.jobs()].reverse();
		const heading = (id: string, label: string): ListRow => ({
			id,
			label,
			heading: true,
			activate: () => {},
		});
		this.list.setRows([
			heading(
				"cache-total",
				`Cache: ${caches.reduce((sum, cache) => sum + cache.entries, 0)} records · ${caches.length} stores`,
			),
			...caches.map(
				(cache): ListRow => ({
					id: `cache-${cache.namespace}`,
					label: `${cache.namespace}: ${cache.entries} records`,
					detail: `${cache.pending} queued updates · Last write: ${cache.updatedAt ? `${Math.max(0, this.diagnostics.now() - cache.updatedAt)}s ago` : "unknown (not written this version)"}`,
					height: 68,
					activate: () => {},
				}),
			),
			heading(
				"work-heading",
				`Work: ${jobs.filter((job) => job.state === "running").length} active`,
			),
			...(jobs.length > 0
				? jobs.map(
						(job): ListRow => ({
							id: `work-${job.id}`,
							label: `${job.label} · ${job.state} · ${job.completed}/${job.total > 0 ? job.total : "?"}`,
							detail: `Reason: ${job.reason} · ${job.elapsed.toFixed(2)}ms elapsed`,
							progress: {
								value:
									job.total > 0 ? Math.min(1, job.completed / job.total) : 0,
								color:
									job.state === "running" ? [0.8, 0.6, 0.1] : [0.2, 0.7, 0.3],
							},
							height: 84,
							activate: () => {},
						}),
					)
				: [heading("work-empty", "No journal work recorded this session")]),
		]);
	}
	private readonly poll = () => {
		if (!this.mounted) return;
		this.refresh();
		this.cancel = this.scheduler.delay(0.5, this.poll);
	};
	onMount(parent: IUIComponent): void {
		this.mounted = true;
		this.list.mount(parent);
		this.poll();
	}
	onUnmount(): void {
		this.mounted = false;
		this.cancel?.();
		this.cancel = undefined;
		this.list.unmount();
	}
	getNavGrid() {
		return this.list.getNavGrid();
	}
	setNavigationChanged(changed?: () => void): void {
		this.changed = changed;
	}
	destroy(): void {
		this.onUnmount();
		this.list.destroy();
	}
}
