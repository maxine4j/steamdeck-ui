import type { ICharacterClient } from "./clients/character-client";
import type { IInventoryClient } from "./clients/inventory-client";
import type { IEventBus } from "./events/types";
import { BagsModule } from "./modules/bags/bags-module";
import { BagsPanel } from "./modules/bags/bags-panel";
import { BuiltInBags } from "./modules/bags/built-in-bags";
import { ModuleManager } from "./modules/module-manager";
import { BuiltInPaperDoll } from "./modules/paper-doll/built-in-paper-doll";
import { PaperDollModule } from "./modules/paper-doll/paper-doll-module";
import { PaperDollPanel } from "./modules/paper-doll/paper-doll-panel";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { type FrameFactory, FramePoolManager } from "./ui/frame-pool-manager";
import { PanelContainer } from "./ui/panel/panel-container";
import { UIOrchestrator } from "./ui/ui-orchestrator";
export function startSteamDeckUI(
	factory: FrameFactory,
	events: IEventBus,
	inventory: IInventoryClient,
	character: ICharacterClient,
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
	const paperDoll = new PaperDollPanel(
		new Frame("paper-doll-frame", pool),
		pool,
		character,
	);
	ui.registerPanel(paperDoll);
	modules.register(
		new PaperDollModule(
			ui,
			events,
			character,
			paperDoll,
			new BuiltInPaperDoll(new FrameSuppression(pool), events),
		),
	);
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
			paperDoll.destroy();
		},
	};
}
