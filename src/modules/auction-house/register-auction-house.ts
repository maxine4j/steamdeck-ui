import type { IAuctionHouseClient } from "../../clients/auction-house-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { AuctionHouseModule } from "./auction-house-module";
import { AuctionHousePanel } from "./auction-house-panel";
export function registerAuctionHouse(
	pool: IFramePoolManager,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: Pick<ModuleManager, "register">,
	client: IAuctionHouseClient,
	scheduler: ITaskScheduler,
): { destroy(): void } {
	const panels = (
		["auction-buy", "auction-sell", "auction-owned"] as const
	).map((id) => new AuctionHousePanel(id, pool, client, () => module.close()));
	const module = new AuctionHouseModule(ui, events, client, panels, scheduler);
	for (const panel of panels) ui.registerPanel(panel, "left", "auction-house");
	modules.register(module);
	return {
		destroy: () => {
			for (const panel of panels) panel.destroy();
		},
	};
}
