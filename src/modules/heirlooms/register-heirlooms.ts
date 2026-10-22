import type { ICollectionsClient } from "../../clients/collections-client";
import type { IHeirloomsClient } from "../../clients/heirlooms-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { HeirloomsModule } from "./heirlooms-module";
import { HeirloomsPanel } from "./heirlooms-panel";
export function registerHeirlooms(
	pool: IFramePoolManager,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: Pick<ModuleManager, "register">,
	client: IHeirloomsClient,
	collections: ICollectionsClient,
	scheduler: ITaskScheduler,
): HeirloomsPanel {
	const panel = new HeirloomsPanel(pool, client, scheduler, () => {
		collections.close();
		ui.closePanel("right", "heirlooms");
	});
	ui.registerPanel(panel, "right");
	modules.register(
		new HeirloomsModule(
			ui,
			events,
			{
				disable: () => collections.disable("heirlooms"),
				restore: () => collections.restore("heirlooms"),
				isOpen: () => collections.isOpen("heirlooms"),
			},
			client,
			panel,
		),
	);
	return panel;
}
