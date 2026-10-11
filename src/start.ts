import type { ICharacterClient } from "./clients/character-client";
import type { IInventoryClient } from "./clients/inventory-client";
import type { IMountsClient } from "./clients/mounts-client";
import type { IReputationClient } from "./clients/reputation-client";
import type { ITitlesClient } from "./clients/titles-client";
import type { IEventBus } from "./events/types";
import { BagsModule } from "./modules/bags/bags-module";
import { BagsPanel } from "./modules/bags/bags-panel";
import { BuiltInBags } from "./modules/bags/built-in-bags";
import { ModuleManager } from "./modules/module-manager";
import { BuiltInMounts } from "./modules/mounts/built-in-mounts";
import { MountsModule } from "./modules/mounts/mounts-module";
import { MountsPanel } from "./modules/mounts/mounts-panel";
import { BuiltInPaperDoll } from "./modules/paper-doll/built-in-paper-doll";
import { PaperDollModule } from "./modules/paper-doll/paper-doll-module";
import { PaperDollPanel } from "./modules/paper-doll/paper-doll-panel";
import { BuiltInReputation } from "./modules/reputation/built-in-reputation";
import { ReputationModule } from "./modules/reputation/reputation-module";
import { ReputationPanel } from "./modules/reputation/reputation-panel";
import { BuiltInTitles } from "./modules/titles/built-in-titles";
import { TitlesModule } from "./modules/titles/titles-module";
import { TitlesPanel } from "./modules/titles/titles-panel";
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
	reputation: IReputationClient,
	titles: ITitlesClient,
	mounts: IMountsClient,
) {
	const pool = new FramePoolManager(factory);
	const characterSuppression = new FrameSuppression(pool);
	const builtInReputation = new BuiltInReputation(characterSuppression, events);
	const ui = new UIOrchestrator(
		(position) =>
			new PanelContainer(
				position,
				position,
				new Frame(`container-${position}`, pool),
				(id, button) => new Frame(id, pool, button ? "Button" : "Frame"),
				(selected) => {
					if (selected.id === "reputation") builtInReputation.open();
					else if (selected.id === "paper-doll" || selected.id === "titles")
						character.open();
				},
			),
	);
	const panel = new BagsPanel(
		"bags",
		"Bags",
		new Frame("bags-frame", pool),
		pool,
		inventory,
	);
	ui.registerPanel(panel, "right");
	const modules = new ModuleManager();
	const builtInMounts = new BuiltInMounts(new FrameSuppression(pool), events);
	const mountsPanel = new MountsPanel(pool, mounts, () => {
		builtInMounts.close();
		ui.closePanel("left", "mounts");
	});
	modules.register(new MountsModule(ui, events, mountsPanel, builtInMounts));
	const paperDoll = new PaperDollPanel(
		new Frame("paper-doll-frame", pool),
		pool,
		character,
	);
	ui.registerPanel(paperDoll, "left");
	modules.register(
		new PaperDollModule(
			ui,
			events,
			character,
			paperDoll,
			new BuiltInPaperDoll(characterSuppression, events),
		),
	);
	const closeCharacter = () => {
		builtInReputation.close();
		ui.closePanel("left");
	};
	const reputationPanel = new ReputationPanel(pool, reputation, closeCharacter);
	const titlesPanel = new TitlesPanel(pool, titles, closeCharacter);
	ui.registerPanel(reputationPanel, "left");
	ui.registerPanel(titlesPanel, "left");
	ui.registerPanel(mountsPanel, "left");
	modules.register(
		new ReputationModule(ui, events, reputationPanel, builtInReputation),
	);
	modules.register(
		new TitlesModule(ui, events, titlesPanel, new BuiltInTitles(events)),
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
			reputationPanel.destroy();
			titlesPanel.destroy();
			mountsPanel.destroy();
		},
	};
}
