import { AchievementsClient } from "./clients/achievements-client";
import { ActionBarClient } from "./clients/action-bar-client";
import { AddonConfigClient } from "./clients/addon-config-client";
import { BankClient } from "./clients/bank-client";
import { CharacterClient } from "./clients/character-client";
import { CollectionCache } from "./clients/collection-cache";
import { ControllerInputClient } from "./clients/controller-input-client";
import { CurrencyClient } from "./clients/currency-client";
import { DialogueCamera } from "./clients/dialogue-camera";
import { DialogueClient } from "./clients/dialogue-client";
import { DungeonFinderClient } from "./clients/dungeon-finder-client";
import { InventoryClient } from "./clients/inventory-client";
import { MailClient } from "./clients/mail-client";
import { MapClient } from "./clients/map-client";
import { MountsClient } from "./clients/mounts-client";
import { PetsClient } from "./clients/pets-client";
import { PvpFinderClient } from "./clients/pvp-finder-client";
import { ReputationClient } from "./clients/reputation-client";
import { SlashCommandsClient } from "./clients/slash-commands-client";
import { TalentsClient } from "./clients/talents-client";
import { TaskScheduler } from "./clients/task-scheduler";
import { TitlesClient } from "./clients/titles-client";
import { ToysClient } from "./clients/toys-client";
import { VendorClient } from "./clients/vendor-client";
import { WowEventBus } from "./events/wow-event-bus";
import { startSteamDeckUI } from "./start";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { NativeCursor } from "./ui/components/native-cursor";
import { NativeLayout } from "./ui/components/native-layout";
import { NativeNavigation } from "./ui/components/native-navigation";
import { NativeScriptSuppression } from "./ui/components/native-script-suppression";
import { NativeScrollIndicator } from "./ui/components/scroll-indicator";
import { FramePoolManager } from "./ui/frame-pool-manager";
import { WowFrameFactory } from "./ui/wow-frame-factory";

const frameFactory = new WowFrameFactory();
const events = new WowEventBus(frameFactory);
const bank = new BankClient();
const inventory = new InventoryClient(bank);
const character = new CharacterClient();
const reputation = new ReputationClient();
const titles = new TitlesClient();
const scheduler = new TaskScheduler();
const collectionCache = new CollectionCache(scheduler);
startSteamDeckUI(
	frameFactory,
	events,
	inventory,
	character,
	reputation,
	titles,
	new MountsClient(scheduler, collectionCache),
	new ActionBarClient(new FrameSuppression(new FramePoolManager(frameFactory))),
	new ControllerInputClient(
		events,
		new Frame("navigation-input", new FramePoolManager(frameFactory)),
	),
	scheduler,
	new TalentsClient(),
	new DungeonFinderClient(),
	new CurrencyClient(scheduler),
	new DialogueClient(),
	new DialogueCamera(),
	new VendorClient(),
	new AchievementsClient(scheduler, collectionCache, events),
	new ToysClient(scheduler, collectionCache),
	new SlashCommandsClient(),
	new AddonConfigClient(),
	new MapClient(
		events,
		new NativeLayout(scheduler),
		new NativeNavigation(new FramePoolManager(frameFactory)),
		new NativeCursor(new FramePoolManager(frameFactory)),
		new NativeScrollIndicator(new FramePoolManager(frameFactory)),
	),
	bank,
	new MailClient(
		new FrameSuppression(new FramePoolManager(frameFactory)),
		new NativeScriptSuppression(),
	),
	new PetsClient(scheduler, collectionCache),
	new PvpFinderClient(),
);
