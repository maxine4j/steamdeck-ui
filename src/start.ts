import type { IAchievementsClient } from "./clients/achievements-client";
import type { IActionBarClient } from "./clients/action-bar-client";
import type { IAddonConfigClient } from "./clients/addon-config-client";
import type { IAuctionHouseClient } from "./clients/auction-house-client";
import type { IBankClient } from "./clients/bank-client";
import type { ICharacterClient } from "./clients/character-client";
import { CharacterFrameClient } from "./clients/character-frame-client";
import { CollectionsClient } from "./clients/collections-client";
import type { IControllerInputClient } from "./clients/controller-input-client";
import type { ICurrencyClient } from "./clients/currency-client";
import type { IDialogueCamera } from "./clients/dialogue-camera";
import type { IDialogueClient } from "./clients/dialogue-client";
import type { IDungeonFinderClient } from "./clients/dungeon-finder-client";
import type { IInventoryClient } from "./clients/inventory-client";
import type { IMailClient } from "./clients/mail-client";
import type { IMapClient } from "./clients/map-client";
import type { IMountsClient } from "./clients/mounts-client";
import type { IPetsClient } from "./clients/pets-client";
import type { IPvpFinderClient } from "./clients/pvp-finder-client";
import type { IReputationClient } from "./clients/reputation-client";
import type { ISlashCommandsClient } from "./clients/slash-commands-client";
import type { ISpellbookClient } from "./clients/spellbook-client";
import { TalentTreeClient } from "./clients/talent-tree-client";
import type { ITalentsClient } from "./clients/talents-client";
import type { ITaskScheduler } from "./clients/task-scheduler";
import type { ITitlesClient } from "./clients/titles-client";
import type { IToysClient } from "./clients/toys-client";
import { TransmogClient } from "./clients/transmog-client";
import type { IVendorClient } from "./clients/vendor-client";
import type { IEventBus } from "./events/types";
import { AchievementsModule } from "./modules/achievements/achievements-module";
import { AchievementsPanel } from "./modules/achievements/achievements-panel";
import { BuiltInAchievements } from "./modules/achievements/built-in-achievements";
import { AbilityRing } from "./modules/action-bar/ability-ring";
import { ActionBarModule } from "./modules/action-bar/action-bar-module";
import { CrossBar } from "./modules/action-bar/cross-bar";
import { CrossBarPreview } from "./modules/action-bar/cross-bar-preview";
import { registerAuctionHouse } from "./modules/auction-house/register-auction-house";
import { BagsModule } from "./modules/bags/bags-module";
import { BagsPanel } from "./modules/bags/bags-panel";
import { BuiltInBags } from "./modules/bags/built-in-bags";
import { ItemActionMenu } from "./modules/bags/item-action-menu";
import { ItemGrouping } from "./modules/bags/item-grouping";
import { BankModule } from "./modules/bank/bank-module";
import { BankPanel } from "./modules/bank/bank-panel";
import { BuiltInBank } from "./modules/bank/built-in-bank";
import { ControllerInputModule } from "./modules/controller-input/controller-input-module";
import { BuiltInCurrency } from "./modules/currency/built-in-currency";
import { CurrencyModule } from "./modules/currency/currency-module";
import { CurrencyOptions } from "./modules/currency/currency-options";
import { CurrencyPanel } from "./modules/currency/currency-panel";
import { BuiltInDungeonFinder } from "./modules/dungeon-finder/built-in-dungeon-finder";
import { DungeonFinderModule } from "./modules/dungeon-finder/dungeon-finder-module";
import { DungeonFinderPanel } from "./modules/dungeon-finder/dungeon-finder-panel";
import { registerMail } from "./modules/mail/register-mail";
import { MapModule } from "./modules/map/map-module";
import { MapPanel } from "./modules/map/map-panel";
import { ModuleManager } from "./modules/module-manager";
import { BuiltInMounts } from "./modules/mounts/built-in-mounts";
import { MountActionMenu } from "./modules/mounts/mount-action-menu";
import { MountsModule } from "./modules/mounts/mounts-module";
import { MountsPanel } from "./modules/mounts/mounts-panel";
import { BuiltInDialogue } from "./modules/npc-dialogue/built-in-dialogue";
import { DialogueModule } from "./modules/npc-dialogue/dialogue-module";
import { DialoguePanel } from "./modules/npc-dialogue/dialogue-panel";
import { BuiltInPaperDoll } from "./modules/paper-doll/built-in-paper-doll";
import { BuiltInTitles } from "./modules/paper-doll/built-in-titles";
import { EquipmentActionMenu } from "./modules/paper-doll/equipment-action-menu";
import { PaperDollModule } from "./modules/paper-doll/paper-doll-module";
import { PaperDollPanel } from "./modules/paper-doll/paper-doll-panel";
import { PetActionMenu } from "./modules/pets/pet-action-menu";
import { BuiltInPets, PetsModule } from "./modules/pets/pets-module";
import { PetsPanel } from "./modules/pets/pets-panel";
import { BuiltInReputation } from "./modules/reputation/built-in-reputation";
import { ReputationActionMenu } from "./modules/reputation/reputation-action-menu";
import { ReputationModule } from "./modules/reputation/reputation-module";
import { ReputationPanel } from "./modules/reputation/reputation-panel";
import { SlashCommandsModule } from "./modules/slash-commands/slash-commands-module";
import { SpellBindingPrompt } from "./modules/spellbook/spell-binding-prompt";
import { SpellbookModule } from "./modules/spellbook/spellbook-module";
import { SpellbookPanel } from "./modules/spellbook/spellbook-panel";
import { BuiltInTalents } from "./modules/talents/built-in-talents";
import { TalentTreePanel } from "./modules/talents/talent-tree-panel";
import { TalentsModule } from "./modules/talents/talents-module";
import { TalentsPanel } from "./modules/talents/talents-panel";
import { BuiltInToys } from "./modules/toys/built-in-toys";
import { ToyActionMenu } from "./modules/toys/toy-action-menu";
import { ToysModule } from "./modules/toys/toys-module";
import { ToysPanel } from "./modules/toys/toys-panel";
import { TransmogModule } from "./modules/transmog/transmog-module";
import { TransmogPanel } from "./modules/transmog/transmog-panel";
import { BuiltInVendor } from "./modules/vendor/built-in-vendor";
import { VendorModule } from "./modules/vendor/vendor-module";
import { VendorPanel } from "./modules/vendor/vendor-panel";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { ItemTooltip } from "./ui/components/item-tooltip";
import { Modal } from "./ui/components/modal";
import { NativeLayout } from "./ui/components/native-layout";
import { NativeNavigation } from "./ui/components/native-navigation";
import { NativeScriptSuppression } from "./ui/components/native-script-suppression";
import { NativeVisibility } from "./ui/components/native-visibility";
import { type FrameFactory, FramePoolManager } from "./ui/frame-pool-manager";
import { NavigationManager } from "./ui/navigation/navigation-manager";
import { PanelContainer } from "./ui/panel/panel-container";
import { UIOrchestrator } from "./ui/ui-orchestrator";

// Keep feature construction in small functions: WoW limits Lua closures to 60 upvalues.
function registerBank(
	pool: FramePoolManager,
	navigation: NavigationManager,
	events: IEventBus,
	ui: UIOrchestrator,
	modules: ModuleManager,
	bank: IBankClient,
	scheduler: ITaskScheduler,
	grouping: ItemGrouping,
) {
	const modal = new Modal("bank-options", pool, navigation, events);
	const panels = [
		new BankPanel("standard", pool, bank, modal, scheduler, grouping),
		new BankPanel("warband", pool, bank, modal, scheduler, grouping),
	];
	for (const panel of panels) ui.registerPanel(panel, "left", "bank");
	modules.register(
		new BankModule(
			ui,
			events,
			bank,
			panels,
			new BuiltInBank(new FrameSuppression(pool)),
			scheduler,
		),
	);
	return {
		destroy(): void {
			for (const panel of panels) panel.destroy();
			modal.destroy();
		},
	};
}

function registerTransmog(
	pool: FramePoolManager,
	events: IEventBus,
	ui: UIOrchestrator,
	modules: ModuleManager,
	scheduler: ITaskScheduler,
) {
	const client = new TransmogClient(
		new NativeLayout(scheduler),
		new NativeNavigation(pool),
		events,
		new NativeVisibility(),
	);
	const panel = new TransmogPanel(pool, client, scheduler, () =>
		ui.closePanel("fullscreen", "transmog"),
	);
	ui.registerPanel(panel);
	modules.register(new TransmogModule(ui, events, client, panel));
	return panel;
}

function registerMap(
	pool: FramePoolManager,
	navigation: NavigationManager,
	events: IEventBus,
	ui: UIOrchestrator,
	modules: ModuleManager,
	map: IMapClient,
	scheduler: ITaskScheduler,
) {
	const modal = new Modal("quest-options", pool, navigation, events);
	const panel = new MapPanel(pool, map, modal, () => {
		map.close();
		ui.closePanel("fullscreen", "map");
	});
	ui.registerPanel(panel);
	modules.register(new MapModule(ui, events, map, panel, scheduler));
	return { panel, modal };
}

function registerCollections(
	pool: FramePoolManager,
	navigation: NavigationManager,
	events: IEventBus,
	ui: UIOrchestrator,
	modules: ModuleManager,
	mounts: IMountsClient,
	toys: IToysClient,
	scheduler: ITaskScheduler,
	pets: IPetsClient,
) {
	const collections = new CollectionsClient(new FrameSuppression(pool), events);
	const builtInMounts = new BuiltInMounts(collections);
	const builtInToys = new BuiltInToys(collections);
	const builtInPets = new BuiltInPets(collections);
	const petModal = new Modal("pet-actions", pool, navigation, events);
	const petMenu = new PetActionMenu(petModal, pets, () => petsPanel.refresh());
	const petsPanel = new PetsPanel(pool, pets, petMenu, scheduler, () =>
		builtInPets.close(),
	);
	ui.registerPanel(petsPanel, "right");
	modules.register(new PetsModule(ui, events, petsPanel, builtInPets, pets));
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
	return { toyModal, mountModal, petModal, toysPanel, mountsPanel, petsPanel };
}

function registerPlayerSpells(
	pool: FramePoolManager,
	navigation: NavigationManager,
	events: IEventBus,
	ui: UIOrchestrator,
	modules: ModuleManager,
	talents: ITalentsClient,
	spellbook: ISpellbookClient,
	controller: IControllerInputClient,
	scheduler: ITaskScheduler,
	native: BuiltInTalents,
	actions: IActionBarClient,
) {
	const talentsPanel = new TalentsPanel(
		pool,
		talents,
		() => {
			native.close();
			ui.closePanel("left", "talents");
		},
		scheduler,
		() => {
			if (native.isOpen()) native.close();
		},
		() => native.openFull(),
	);
	const talentTreePanel = new TalentTreePanel(
		pool,
		new TalentTreeClient(
			native,
			new NativeLayout(scheduler),
			new NativeNavigation(pool),
			events,
			new NativeVisibility(),
		),
		scheduler,
		() => ui.closePanel("fullscreen", "talent-tree"),
	);
	const prompt = new SpellBindingPrompt(
		pool,
		navigation,
		events,
		controller,
		spellbook,
		scheduler,
		new CrossBarPreview(pool, actions),
	);
	const spellbookPanel = new SpellbookPanel(pool, spellbook, prompt, () => {
		if (native.isSpellbookOpen()) native.close();
		ui.closePanel("left", "spellbook");
	});
	ui.registerPanel(talentTreePanel);
	ui.registerPanel(talentsPanel, "left");
	ui.registerPanel(spellbookPanel, "left");
	modules.register(
		new TalentsModule(ui, events, talentsPanel, native, talentTreePanel),
	);
	modules.register(new SpellbookModule(ui, events, spellbookPanel, native));
	return {
		destroy(): void {
			prompt.destroy();
			spellbookPanel.destroy();
			talentsPanel.destroy();
			talentTreePanel.destroy();
		},
	};
}

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
	slashCommands: ISlashCommandsClient,
	config: IAddonConfigClient,
	map: IMapClient,
	bank: IBankClient,
	mail: IMailClient,
	pets: IPetsClient,
	pvpFinder: IPvpFinderClient,
	spellbook: ISpellbookClient,
	auctionHouse: IAuctionHouseClient,
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
						selected.id !== "spellbook" &&
						(builtInTalents.isOpen() || builtInTalents.isSpellbookOpen())
					)
						builtInTalents.close();
					if (selected.id === "spellbook") builtInTalents.openSpellbook();
					else if (selected.id === "dungeon-finder")
						builtInDungeonFinder.open();
					else if (selected.id === "talents") builtInTalents.open();
					else if (selected.id === "reputation") builtInReputation.open();
					else if (selected.id === "currency") builtInCurrency.open();
					else if (selected.id === "paper-doll") character.open();
				},
				navigation,
				position === "left"
					? { right: "right" }
					: position === "right"
						? { left: "left" }
						: {},
				containerId !== position
					? []
					: position === "left"
						? [
								["paper-doll", "reputation"],
								["talents", "spellbook"],
								["achievements", "dungeon-finder"],
							]
						: position === "right"
							? [
									["bags", "currency"],
									["mounts", "toys", "pets"],
								]
							: [],
				events,
			),
	);
	const grouping = new ItemGrouping();
	const panel = new BagsPanel(
		"bags",
		"Bags",
		new Frame("bags-frame", pool),
		pool,
		inventory,
		itemMenu,
		scheduler,
		grouping,
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
	const auctionHouseFeature = registerAuctionHouse(
		pool,
		events,
		ui,
		modules,
		auctionHouse,
		scheduler,
	);
	const transmogPanel = registerTransmog(pool, events, ui, modules, scheduler);
	const bankFeature = registerBank(
		pool,
		navigation,
		events,
		ui,
		modules,
		bank,
		scheduler,
		grouping,
	);
	const mailFeature = registerMail(
		pool,
		navigation,
		events,
		ui,
		modules,
		mail,
		scheduler,
	);
	const mapFeature = registerMap(
		pool,
		navigation,
		events,
		ui,
		modules,
		map,
		scheduler,
	);
	modules.register(new SlashCommandsModule(slashCommands));
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
	modules.register(
		new AchievementsModule(
			ui,
			events,
			achievementsPanel,
			builtInAchievements,
			achievements,
		),
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
	const dungeonQueueConfirmation = new Modal(
		"dungeon-queue-confirmation",
		pool,
		navigation,
		events,
	);
	const dungeonFinderPanel = new DungeonFinderPanel(
		pool,
		dungeonFinder,
		() => {
			builtInDungeonFinder.close();
			ui.closePanel("left", "dungeon-finder");
		},
		scheduler,
		dungeonQueueConfirmation,
		pvpFinder,
	);
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
	const collectionsFeature = registerCollections(
		pool,
		navigation,
		events,
		ui,
		modules,
		mounts,
		toys,
		scheduler,
		pets,
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
		titles,
		scheduler,
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
			new BuiltInTitles(events),
		),
	);
	const closeCharacter = () => {
		builtInReputation.close();
		ui.closePanel("left");
	};
	const reputationModal = new Modal(
		"reputation-options",
		pool,
		navigation,
		events,
	);
	const reputationMenu = new ReputationActionMenu(
		reputationModal,
		reputation,
		() => reputationPanel.refresh(),
	);
	const reputationPanel = new ReputationPanel(
		pool,
		reputation,
		closeCharacter,
		scheduler,
		reputationMenu,
	);
	ui.registerPanel(reputationPanel, "left");
	ui.registerPanel(collectionsFeature.mountsPanel, "right");
	const playerSpells = registerPlayerSpells(
		pool,
		navigation,
		events,
		ui,
		modules,
		talents,
		spellbook,
		controller,
		scheduler,
		builtInTalents,
		actions,
	);
	ui.registerPanel(achievementsPanel, "left");
	ui.registerPanel(dungeonFinderPanel, "left");
	modules.register(
		new ReputationModule(ui, events, reputationPanel, builtInReputation),
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
			auctionHouseFeature.destroy();
			bankFeature.destroy();
			mailFeature.destroy();
			mapFeature.panel.destroy();
			mapFeature.modal.destroy();
			dialoguePanel.destroy();
			itemModal.destroy();
			currencyModal.destroy();
			reputationModal.destroy();
			dungeonQueueConfirmation.destroy();
			collectionsFeature.toyModal.destroy();
			collectionsFeature.petModal.destroy();
			collectionsFeature.mountModal.destroy();
			navigation.destroy();
			itemTooltip.destroy();
			ui.destroy();
			panel.destroy();
			paperDoll.destroy();
			reputationPanel.destroy();
			currencyPanel.destroy();
			collectionsFeature.mountsPanel.destroy();
			collectionsFeature.toysPanel.destroy();
			collectionsFeature.petsPanel.destroy();
			playerSpells.destroy();
			transmogPanel.destroy();
			dungeonFinderPanel.destroy();
			vendorPanel.destroy();
			buybackPanel.destroy();
			achievementsPanel.destroy();
		},
	};
}
