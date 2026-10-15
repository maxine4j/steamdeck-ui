import type { IAppearancesClient } from "../../clients/appearances-client";
import type { ICollectionsClient } from "../../clients/collections-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { AppearancesModule } from "./appearances-module";
import { AppearancesPanel } from "./appearances-panel";

export function registerAppearances(
	pool: IFramePoolManager,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: Pick<ModuleManager, "register">,
	client: IAppearancesClient,
	collections: ICollectionsClient,
	scheduler: ITaskScheduler,
): AppearancesPanel {
	const panel = new AppearancesPanel(pool, client, scheduler, () => {
		collections.close();
		ui.closePanel("right", "appearances");
	});
	ui.registerPanel(panel, "right");
	modules.register(
		new AppearancesModule(
			ui,
			events,
			{
				disable: () => collections.disable("appearances"),
				restore: () => collections.restore("appearances"),
				isOpen: () => collections.isOpen("appearances"),
			},
			client,
		),
	);
	return panel;
}
