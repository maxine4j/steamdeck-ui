import type { CacheStats } from "../../clients/collection-cache";
import type { DebugClient } from "../../clients/debug-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { CachePerformancePanel } from "./cache-performance-panel";
import { DebugLogsPanel } from "./debug-logs-panel";
import { DebugModule } from "./debug-module";

export function registerDebug(
	pool: IFramePoolManager,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: ModuleManager,
	client: DebugClient,
	stats: () => readonly CacheStats[],
	scheduler: ITaskScheduler,
) {
	const close = () => ui.closePanel("left", undefined, "debug");
	const logs = new DebugLogsPanel(
		pool,
		client.diagnostics,
		() =>
			stats()
				.map(
					(cache) =>
						`${cache.namespace}: ${cache.entries} records, ${cache.pending} queued, last write ${cache.updatedAt ? `${Math.max(0, client.diagnostics.now() - cache.updatedAt)}s ago` : "unknown"}`,
				)
				.join("\n"),
		close,
		scheduler,
	);
	const cache = new CachePerformancePanel(
		pool,
		client.diagnostics,
		stats,
		scheduler,
		close,
	);
	modules.register(new DebugModule(ui, events, client, logs, cache));
	return {
		destroy(): void {
			logs.destroy();
			cache.destroy();
		},
	};
}
