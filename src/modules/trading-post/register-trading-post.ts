import type { ITaskScheduler } from "../../clients/task-scheduler";
import { TradingPostClient } from "../../clients/trading-post-client";
import type { IEventBus } from "../../events/types";
import { NativeLayout } from "../../ui/components/native-layout";
import { NativeNavigation } from "../../ui/components/native-navigation";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { TradingPostModule } from "./trading-post-module";
import { TradingPostPanel } from "./trading-post-panel";

export function registerTradingPost(
	pool: IFramePoolManager,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: ModuleManager,
	scheduler: ITaskScheduler,
) {
	const client = new TradingPostClient(
		events,
		new NativeLayout(scheduler),
		new NativeNavigation(pool),
	);
	const panel = new TradingPostPanel(pool, client, scheduler, () =>
		ui.closePanel("fullscreen", "trading-post"),
	);
	ui.registerPanel(panel);
	modules.register(new TradingPostModule(ui, events, client, panel));
	return panel;
}
