import { NativeDialogsClient } from "../../clients/native-dialogs-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import { NativeDialogNavigation } from "../../ui/components/native-dialog-navigation";
import { NativeNavigation } from "../../ui/components/native-navigation";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationManager } from "../../ui/navigation/navigation-manager";
import type { ModuleManager } from "../module-manager";
import { SystemDialogsModule } from "./system-dialogs-module";

export function registerSystemDialogs(
	pool: IFramePoolManager,
	modules: ModuleManager,
	events: IEventBus,
	navigation: NavigationManager,
	scheduler: ITaskScheduler,
): void {
	modules.register(
		new SystemDialogsModule(
			new NativeDialogsClient(
				events,
				new NativeDialogNavigation(new NativeNavigation(pool)),
				scheduler,
			),
			events,
			navigation,
		),
	);
}
