import { DelvesClient } from "../../clients/delves-client";
import { LootClient } from "../../clients/loot-client";
import {
	NativeDialogsClient,
	type NativeGameMenuAction,
} from "../../clients/native-dialogs-client";
import { PlayerMenuClient } from "../../clients/player-menu-client";
import { PreyMapClient } from "../../clients/prey-map-client";
import { PreyTargetsClient } from "../../clients/prey-targets-client";
import { SettingsClient } from "../../clients/settings-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import { NativeDialogNavigation } from "../../ui/components/native-dialog-navigation";
import { NativeMarkers } from "../../ui/components/native-markers";
import { NativeNavigation } from "../../ui/components/native-navigation";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { NavigationManager } from "../../ui/navigation/navigation-manager";
import type { ModuleManager } from "../module-manager";
import { PreyMapPresentation } from "../prey/prey-map-presentation";
import { PlayerSettingsPresentation } from "./player-settings-presentation";
import { SystemDialogsModule } from "./system-dialogs-module";

export function registerSystemDialogs(
	pool: IFramePoolManager,
	modules: ModuleManager,
	events: IEventBus,
	navigation: NavigationManager,
	scheduler: ITaskScheduler,
	menuActions: readonly NativeGameMenuAction[] = [],
): void {
	const preyNavigation = new NativeNavigation(pool);
	const delveNavigation = new NativeNavigation(pool);
	modules.register(
		new SystemDialogsModule(
			new NativeDialogsClient(
				events,
				new NativeDialogNavigation(new NativeNavigation(pool)),
				scheduler,
				[
					new SettingsClient(
						events,
						new NativeDialogNavigation(new NativeNavigation(pool)),
						scheduler,
					),
					new DelvesClient(
						events,
						delveNavigation,
						new NativeDialogNavigation(delveNavigation),
						scheduler,
					),
					new LootClient(
						events,
						new NativeDialogNavigation(new NativeNavigation(pool)),
						scheduler,
					),
					new PlayerMenuClient(
						events,
						new NativeDialogNavigation(new NativeNavigation(pool)),
						scheduler,
						new PlayerSettingsPresentation(pool),
					),
					new PreyMapClient(
						events,
						preyNavigation,
						new NativeDialogNavigation(preyNavigation),
						scheduler,
						new PreyTargetsClient(),
						new PreyMapPresentation(new NativeMarkers(pool)),
					),
				],
				menuActions,
			),
			events,
			navigation,
		),
	);
}
