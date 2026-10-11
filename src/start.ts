import type { IInventoryClient } from "./clients/inventory-client";
import type { IEventBus } from "./events/types";
import { BagsModule } from "./modules/bags/bags-module";
import { BagsPanel } from "./modules/bags/bags-panel";
import { BuiltInBags } from "./modules/bags/built-in-bags";
import { ModuleManager } from "./modules/module-manager";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { type FrameFactory, FramePoolManager } from "./ui/frame-pool-manager";
import { PanelContainer } from "./ui/panel/panel-container";
import { UIOrchestrator } from "./ui/ui-orchestrator";
export function startSteamDeckUI(
	factory: FrameFactory,
	events: IEventBus,
	inventory: IInventoryClient,
) {
	const pool = new FramePoolManager(factory);
	const ui = new UIOrchestrator(
		(position) =>
			new PanelContainer(
				position,
				position,
				new Frame(`container-${position}`, pool),
			),
	);
	const panel = new BagsPanel(
		"bags",
		"Bags",
		new Frame("bags-frame", pool),
		pool,
		inventory,
	);
	ui.registerPanel(panel);
	const modules = new ModuleManager();
	modules.register(
		new BagsModule(
			ui,
			events,
			inventory,
			panel,
			new BuiltInBags(new FrameSuppression(pool), events),
		),
	);
	const login = () => modules.start();
	events.subscribe("PLAYER_LOGIN", login);
	return {
		ui,
		stop(): void {
			events.unsubscribe("PLAYER_LOGIN", login);
			modules.stop();
			ui.destroy();
			panel.destroy();
		},
	};
}
