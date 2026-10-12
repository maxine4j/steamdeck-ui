import type { IActionBarClient } from "./clients/action-bar-client";
import type { ICharacterClient } from "./clients/character-client";
import type { IControllerInputClient } from "./clients/controller-input-client";
import type { IInventoryClient } from "./clients/inventory-client";
import type { IMountsClient } from "./clients/mounts-client";
import type { IReputationClient } from "./clients/reputation-client";
import type { ITalentsClient } from "./clients/talents-client";
import type { ITaskScheduler } from "./clients/task-scheduler";
import type { ITitlesClient } from "./clients/titles-client";
import type { IEventBus } from "./events/types";
import { AbilityRing } from "./modules/action-bar/ability-ring";
import { ActionBarModule } from "./modules/action-bar/action-bar-module";
import { CrossBar } from "./modules/action-bar/cross-bar";
import { BagsModule } from "./modules/bags/bags-module";
import { BagsPanel } from "./modules/bags/bags-panel";
import { BuiltInBags } from "./modules/bags/built-in-bags";
import { ItemActionMenu } from "./modules/bags/item-action-menu";
import { ControllerInputModule } from "./modules/controller-input/controller-input-module";
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
import { BuiltInTalents } from "./modules/talents/built-in-talents";
import { TalentsModule } from "./modules/talents/talents-module";
import { TalentsPanel } from "./modules/talents/talents-panel";
import { BuiltInTitles } from "./modules/titles/built-in-titles";
import { TitlesModule } from "./modules/titles/titles-module";
import { TitlesPanel } from "./modules/titles/titles-panel";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { Modal } from "./ui/components/modal";
import { type FrameFactory, FramePoolManager } from "./ui/frame-pool-manager";
import { NavigationManager } from "./ui/navigation/navigation-manager";
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
	actions: IActionBarClient,
	controller: IControllerInputClient,
	scheduler: ITaskScheduler,
	talents: ITalentsClient,
) {
	const navigation = new NavigationManager(events, (active) =>
		controller.setActive(active),
	);
	const pool = new FramePoolManager(factory);
	const itemModal = new Modal("item-actions", pool, navigation, events);
	const itemMenu = new ItemActionMenu(itemModal, inventory);
	const characterSuppression = new FrameSuppression(pool);
	const builtInReputation = new BuiltInReputation(characterSuppression, events);
	const builtInTalents = new BuiltInTalents(new FrameSuppression(pool), events);
	const ui = new UIOrchestrator(
		(position) =>
			new PanelContainer(
				position,
				position,
				new Frame(`container-${position}`, pool),
				(id, button) => new Frame(id, pool, button ? "Button" : "Frame"),
				(selected) => {
					if (selected.id === "talents") builtInTalents.open();
					else if (selected.id === "reputation") builtInReputation.open();
					else if (selected.id === "paper-doll" || selected.id === "titles")
						character.open();
				},
				navigation,
				position === "left"
					? { right: "right" }
					: position === "right"
						? { left: "left" }
						: {},
			),
	);
	const panel = new BagsPanel(
		"bags",
		"Bags",
		new Frame("bags-frame", pool),
		pool,
		inventory,
		itemMenu,
		scheduler,
	);
	ui.registerPanel(panel, "right");
	const modules = new ModuleManager();
	modules.register(new ControllerInputModule(controller));
	const crossBar = new CrossBar(pool, actions);
	const abilityRing = new AbilityRing(pool, actions);
	modules.register(
		new ActionBarModule(events, actions, {
			initialize(): void {
				crossBar.initialize();
				abilityRing.initialize();
			},
			refresh(): void {
				crossBar.refresh();
				abilityRing.refresh();
			},
			destroy(): void {
				abilityRing.destroy();
				crossBar.destroy();
			},
		}),
	);
	const builtInMounts = new BuiltInMounts(new FrameSuppression(pool), events);
	const mountsPanel = new MountsPanel(
		pool,
		mounts,
		() => {
			builtInMounts.close();
			ui.closePanel("right", "mounts");
		},
		scheduler,
	);
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
			scheduler,
		),
	);
	const closeCharacter = () => {
		builtInReputation.close();
		ui.closePanel("left");
	};
	const reputationPanel = new ReputationPanel(
		pool,
		reputation,
		closeCharacter,
		scheduler,
	);
	const titlesPanel = new TitlesPanel(pool, titles, closeCharacter, scheduler);
	ui.registerPanel(reputationPanel, "left");
	ui.registerPanel(titlesPanel, "left");
	ui.registerPanel(mountsPanel, "right");
	const talentsPanel = new TalentsPanel(
		pool,
		talents,
		() => {
			builtInTalents.close();
			ui.closePanel("left", "talents");
		},
		scheduler,
		() => {
			if (builtInTalents.isOpen()) builtInTalents.close();
		},
	);
	ui.registerPanel(talentsPanel, "left");
	modules.register(new TalentsModule(ui, events, talentsPanel, builtInTalents));
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
			scheduler,
		),
	);
	const login = () => modules.start();
	events.subscribe("PLAYER_LOGIN", login);
	return {
		ui,
		navigation,
		stop(): void {
			events.unsubscribe("PLAYER_LOGIN", login);
			modules.stop();
			itemModal.destroy();
			navigation.destroy();
			ui.destroy();
			panel.destroy();
			paperDoll.destroy();
			reputationPanel.destroy();
			titlesPanel.destroy();
			mountsPanel.destroy();
			talentsPanel.destroy();
		},
	};
}
