import type { IEventBus } from "./events/types";
import { BagsModule } from "./modules/bags/bags-module";
import { ModuleManager } from "./modules/module-manager";
import { Frame } from "./ui/components/frame";
import { type FrameFactory, FramePoolManager } from "./ui/frame-pool-manager";
import { Panel } from "./ui/panel/panel";
import { PanelContainer } from "./ui/panel/panel-container";
import { UIOrchestrator } from "./ui/ui-orchestrator";
export function startSteamDeckUI(factory: FrameFactory, events: IEventBus) {
	const pool = new FramePoolManager(factory);
	const ui = new UIOrchestrator(
		(position) =>
			new PanelContainer(
				position,
				position,
				new Frame(`container-${position}`, pool),
			),
	);
	const panel = new Panel("bags", "Bags", new Frame("bags-frame", pool));
	ui.registerPanel(panel);
	const modules = new ModuleManager();
	modules.register(new BagsModule(ui));
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
