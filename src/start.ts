import type { IActionBarClient } from "./clients/action-bar-client";
import type { ICharacterClient } from "./clients/character-client";
import { CharacterFrameClient } from "./clients/character-frame-client";
import type { IControllerInputClient } from "./clients/controller-input-client";
import type { ICurrencyClient } from "./clients/currency-client";
import type { IDungeonFinderClient } from "./clients/dungeon-finder-client";
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
import { BuiltInCurrency } from "./modules/currency/built-in-currency";
import { CurrencyModule } from "./modules/currency/currency-module";
import { CurrencyOptions } from "./modules/currency/currency-options";
import { CurrencyPanel } from "./modules/currency/currency-panel";
import { BuiltInDungeonFinder } from "./modules/dungeon-finder/built-in-dungeon-finder";
import { DungeonFinderModule } from "./modules/dungeon-finder/dungeon-finder-module";
import { DungeonFinderPanel } from "./modules/dungeon-finder/dungeon-finder-panel";
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
import { ItemTooltip } from "./ui/components/item-tooltip";
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
	dungeonFinder: IDungeonFinderClient,
	currency: ICurrencyClient,
) {
	const pool = new FramePoolManager(factory);
	const itemTooltip = new ItemTooltip(pool);
	const navigation = new NavigationManager(
		events,
		(active) => controller.setActive(active),
		(control) => itemTooltip.setItem(control?.tooltipItem?.()),
	);
	const itemModal = new Modal("item-actions", pool, navigation, events);
	const itemMenu = new ItemActionMenu(itemModal, inventory);
	const characterSuppression = new FrameSuppression(pool);
	const characterFrame = new CharacterFrameClient(characterSuppression, events);
	const builtInReputation = new BuiltInReputation(characterFrame);
	const builtInCurrency = new BuiltInCurrency(characterFrame);
	const currencyModal = new Modal("currency-options", pool, navigation, events);
	const builtInTalents = new BuiltInTalents(new FrameSuppression(pool), events);
	const builtInDungeonFinder = new BuiltInDungeonFinder(
		new FrameSuppression(pool),
		events,
	);
	const ui = new UIOrchestrator(
		(position) =>
			new PanelContainer(
				position,
				position,
				new Frame(`container-${position}`, pool),
				(id, button) => new Frame(id, pool, button ? "Button" : "Frame"),
				(selected) => {
					if (selected.id === "dungeon-finder") builtInDungeonFinder.open();
					else if (selected.id === "talents") builtInTalents.open();
					else if (selected.id === "reputation") builtInReputation.open();
					else if (selected.id === "currency") builtInCurrency.open();
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
	const currencyOptions = new CurrencyOptions(currencyModal, currency, () =>
		currencyPanel.refresh(),
	);
	const currencyPanel = new CurrencyPanel(
		pool,
		currency,
		currencyOptions,
		() => {
			builtInCurrency.close();
			ui.closePanel("right", "currency");
		},
		scheduler,
	);
	ui.registerPanel(currencyPanel, "right");
	const modules = new ModuleManager();
	const dungeonFinderPanel = new DungeonFinderPanel(
		pool,
		dungeonFinder,
		() => {
			builtInDungeonFinder.close();
			ui.closePanel("right", "dungeon-finder");
		},
		scheduler,
	);
	ui.registerPanel(dungeonFinderPanel, "right");
	modules.register(
		new DungeonFinderModule(
			ui,
			events,
			dungeonFinderPanel,
			builtInDungeonFinder,
		),
	);
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
		{
			close: () => characterFrame.close("PaperDollFrame"),
			pickup: (slot) => character.pickup(slot),
			use: (slot) => character.use(slot),
		},
	);
	ui.registerPanel(paperDoll, "left");
	modules.register(
		new PaperDollModule(
			ui,
			events,
			character,
			paperDoll,
			new BuiltInPaperDoll(characterFrame),
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
		new CurrencyModule(ui, events, currencyPanel, builtInCurrency),
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
			currencyModal.destroy();
			navigation.destroy();
			itemTooltip.destroy();
			ui.destroy();
			panel.destroy();
			paperDoll.destroy();
			reputationPanel.destroy();
			currencyPanel.destroy();
			titlesPanel.destroy();
			mountsPanel.destroy();
			talentsPanel.destroy();
			dungeonFinderPanel.destroy();
		},
	};
}
