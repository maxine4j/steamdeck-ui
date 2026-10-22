import { SkyridingClient } from "../../clients/skyriding-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { ModuleManager } from "../module-manager";
import { SkyridingBar } from "./skyriding-bar";
import { SkyridingModule } from "./skyriding-module";

export function registerSkyriding(
	pool: IFramePoolManager,
	modules: ModuleManager,
	events: IEventBus,
	scheduler: ITaskScheduler,
): void {
	modules.register(
		new SkyridingModule(
			new SkyridingClient(),
			new SkyridingBar(pool),
			events,
			scheduler,
		),
	);
}
