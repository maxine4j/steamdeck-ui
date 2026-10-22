import type { IDungeonFinderClient } from "../../clients/dungeon-finder-client";
import { PremadeFinderClient } from "../../clients/premade-finder-client";
import type { IPvpFinderClient } from "../../clients/pvp-finder-client";
import type { ITaskScheduler } from "../../clients/task-scheduler";
import type { IEventBus } from "../../events/types";
import { FrameSuppression } from "../../ui/components/frame-suppression";
import { type IModalNavigation, Modal } from "../../ui/components/modal";
import { NativeDialogNavigation } from "../../ui/components/native-dialog-navigation";
import { NativeLayout } from "../../ui/components/native-layout";
import { NativeNavigation } from "../../ui/components/native-navigation";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { BuiltInDungeonFinder } from "./built-in-dungeon-finder";
import { DungeonFinderModule } from "./dungeon-finder-module";
import { DungeonFinderPanel } from "./dungeon-finder-panel";

export function registerDungeonFinder(
	pool: IFramePoolManager,
	navigation: IModalNavigation,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: Pick<ModuleManager, "register">,
	dungeons: IDungeonFinderClient,
	pvp: IPvpFinderClient,
	scheduler: ITaskScheduler,
) {
	const native = new BuiltInDungeonFinder(new FrameSuppression(pool), events);
	const modal = new Modal(
		"dungeon-queue-confirmation",
		pool,
		navigation,
		events,
	);
	const panel = new DungeonFinderPanel(
		pool,
		dungeons,
		() => {
			native.close();
			ui.closePanel("left", "dungeon-finder");
		},
		scheduler,
		modal,
		pvp,
		new PremadeFinderClient(
			events,
			new NativeLayout(scheduler),
			new NativeDialogNavigation(new NativeNavigation(pool)),
		),
	);
	modules.register(new DungeonFinderModule(ui, events, panel, native));
	return {
		panel,
		open: () => native.open(),
		destroy(): void {
			panel.destroy();
			modal.destroy();
		},
	};
}
