import type { IAchievementsClient } from "./clients/achievements-client";
import type { IActionBarClient } from "./clients/action-bar-client";
import type { IAddonConfigClient } from "./clients/addon-config-client";
import type { ICharacterClient } from "./clients/character-client";
import { CharacterFrameClient } from "./clients/character-frame-client";
import { CollectionsClient } from "./clients/collections-client";
import type { IControllerInputClient } from "./clients/controller-input-client";
import type { ICurrencyClient } from "./clients/currency-client";
import type { IDialogueCamera } from "./clients/dialogue-camera";
import type { IDialogueClient } from "./clients/dialogue-client";
import type { IDungeonFinderClient } from "./clients/dungeon-finder-client";
import type { IInventoryClient } from "./clients/inventory-client";
import type { IMountsClient } from "./clients/mounts-client";
import type { IReputationClient } from "./clients/reputation-client";
import type { ITalentsClient } from "./clients/talents-client";
import type { ITaskScheduler } from "./clients/task-scheduler";
import type { ITitlesClient } from "./clients/titles-client";
import type { IToysClient } from "./clients/toys-client";
import type { IVendorClient } from "./clients/vendor-client";
import type { IEventBus } from "./events/types";
import { AchievementsModule } from "./modules/achievements/achievements-module";
import { AchievementsPanel } from "./modules/achievements/achievements-panel";
import { BuiltInAchievements } from "./modules/achievements/built-in-achievements";
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
import { MountActionMenu } from "./modules/mounts/mount-action-menu";
import { MountsModule } from "./modules/mounts/mounts-module";
import { MountsPanel } from "./modules/mounts/mounts-panel";
import { BuiltInDialogue } from "./modules/npc-dialogue/built-in-dialogue";
import { DialogueModule } from "./modules/npc-dialogue/dialogue-module";
import { DialoguePanel } from "./modules/npc-dialogue/dialogue-panel";
import { BuiltInPaperDoll } from "./modules/paper-doll/built-in-paper-doll";
import { EquipmentActionMenu } from "./modules/paper-doll/equipment-action-menu";
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
import { BuiltInToys } from "./modules/toys/built-in-toys";
import { ToyActionMenu } from "./modules/toys/toy-action-menu";
import { ToysModule } from "./modules/toys/toys-module";
import { ToysPanel } from "./modules/toys/toys-panel";
import { BuiltInVendor } from "./modules/vendor/built-in-vendor";
import { VendorModule } from "./modules/vendor/vendor-module";
import { VendorPanel } from "./modules/vendor/vendor-panel";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { ItemTooltip } from "./ui/components/item-tooltip";
import { Modal } from "./ui/components/modal";
import { NativeScriptSuppression } from "./ui/components/native-script-suppression";
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
	dialogue: IDialogueClient,
	dialogueCamera: IDialogueCamera,
	vendor: IVendorClient,
	achievements: IAchievementsClient,
	toys: IToysClient,
	config: IAddonConfigClient,
) {
	const pool = new FramePoolManager(factory);
	const itemTooltip = new ItemTooltip(pool, events);
	const navigation = new NavigationManager(
		events,
		(active) => controller.setActive(active),
		(control) => {
			itemTooltip.setItem(control?.tooltipItem?.());
			controller.setSecureActions(control?.secureActions?.());
		},
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
		(position, containerId = position) =>
			new PanelContainer(
				position,
				position,
				new Frame(`container-${containerId}`, pool),
				(id, button) => new Frame(id, pool, button ? "Button" : "Frame"),
				(selected) => {
					// Close talents before Blizzard can minimize it into the spellbook.
					if (
						position === "left" &&
						selected.id !== "talents" &&
						builtInTalents.isOpen()
					)
						builtInTalents.close();
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
	const currencyOptions = new CurrencyOptions(
		currencyModal,
		currency,
		() => currencyPanel.refresh(),
		config,
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
		config,
	);
	ui.registerPanel(currencyPanel, "right");
	const modules = new ModuleManager();
	const builtInAchievements = new BuiltInAchievements(
		new FrameSuppression(pool),
		events,
	);
	const achievementsPanel = new AchievementsPanel(
		pool,
		achievements,
		() => {
			builtInAchievements.close();
			ui.closePanel("left", "achievements");
		},
		scheduler,
	);
	ui.registerPanel(achievementsPanel, "left");
	modules.register(
		new AchievementsModule(ui, events, achievementsPanel, builtInAchievements),
	);
	const vendorPanel = new VendorPanel("vendor", pool, vendor, () =>
		vendorModule.close(),
	);
	const buybackPanel = new VendorPanel("buyback", pool, vendor, () =>
		vendorModule.close(),
	);
	ui.registerPanel(vendorPanel, "left", "merchant");
	ui.registerPanel(buybackPanel, "left", "merchant");
	const vendorModule = new VendorModule(
		ui,
		events,
		vendor,
		[vendorPanel, buybackPanel],
		new BuiltInVendor(new FrameSuppression(pool)),
		scheduler,
	);
	modules.register(vendorModule);
	const dialoguePanel = new DialoguePanel(pool, navigation);
	ui.registerPanel(dialoguePanel);
	modules.register(
		new DialogueModule(
			dialogue,
			events,
			scheduler,
			dialoguePanel,
			ui,
			new BuiltInDialogue(new NativeScriptSuppression()),
			dialogueCamera,
		),
	);
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
			refreshContents(): void {
				abilityRing.refreshContents();
			},
			destroy(): void {
				abilityRing.destroy();
				crossBar.destroy();
			},
		}),
	);
	const collections = new CollectionsClient(new FrameSuppression(pool), events);
	const builtInMounts = new BuiltInMounts(collections);
	const builtInToys = new BuiltInToys(collections);
	const toyModal = new Modal("toy-actions", pool, navigation, events);
	const toyMenu = new ToyActionMenu(toyModal, toys, () => toysPanel.refresh());
	const toysPanel = new ToysPanel(pool, toys, toyMenu, scheduler, () =>
		builtInToys.close(),
	);
	ui.registerPanel(toysPanel, "right");
	modules.register(new ToysModule(ui, events, toysPanel, builtInToys, toys));
	const mountModal = new Modal("mount-actions", pool, navigation, events);
	const mountMenu = new MountActionMenu(mountModal, mounts, (id) =>
		mountsPanel.toggleFavourite(id),
	);
	const mountsPanel = new MountsPanel(
		pool,
		mounts,
		() => {
			builtInMounts.close();
			ui.closePanel("right", "mounts");
		},
		scheduler,
		mountMenu,
	);
	modules.register(
		new MountsModule(ui, events, mountsPanel, builtInMounts, mounts),
	);
	const paperDoll = new PaperDollPanel(
		new Frame("paper-doll-frame", pool),
		pool,
		{
			close: () => characterFrame.close("PaperDollFrame"),
			pickup: (slot) => character.pickup(slot),
			use: (slot) => character.use(slot),
		},
		new EquipmentActionMenu(
			new Modal("equipment-options", pool, navigation, events),
			character,
		),
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
			dialoguePanel.destroy();
			itemModal.destroy();
			currencyModal.destroy();
			toyModal.destroy();
			mountModal.destroy();
			navigation.destroy();
			itemTooltip.destroy();
			ui.destroy();
			panel.destroy();
			paperDoll.destroy();
			reputationPanel.destroy();
			currencyPanel.destroy();
			titlesPanel.destroy();
			mountsPanel.destroy();
			toysPanel.destroy();
			talentsPanel.destroy();
			dungeonFinderPanel.destroy();
			vendorPanel.destroy();
			buybackPanel.destroy();
			achievementsPanel.destroy();
		},
	};
}
