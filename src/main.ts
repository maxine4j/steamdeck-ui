import { ActionBarClient } from "./clients/action-bar-client";
import { CharacterClient } from "./clients/character-client";
import { ControllerInputClient } from "./clients/controller-input-client";
import { InventoryClient } from "./clients/inventory-client";
import { MountsClient } from "./clients/mounts-client";
import { ReputationClient } from "./clients/reputation-client";
import { TalentsClient } from "./clients/talents-client";
import { TaskScheduler } from "./clients/task-scheduler";
import { TitlesClient } from "./clients/titles-client";
import { WowEventBus } from "./events/wow-event-bus";
import { startSteamDeckUI } from "./start";
import { Frame } from "./ui/components/frame";
import { FrameSuppression } from "./ui/components/frame-suppression";
import { FramePoolManager } from "./ui/frame-pool-manager";
import { WowFrameFactory } from "./ui/wow-frame-factory";

const frameFactory = new WowFrameFactory();
const events = new WowEventBus(frameFactory);
const inventory = new InventoryClient();
const character = new CharacterClient();
const reputation = new ReputationClient();
const titles = new TitlesClient();
const scheduler = new TaskScheduler();
startSteamDeckUI(
	frameFactory,
	events,
	inventory,
	character,
	reputation,
	titles,
	new MountsClient(scheduler),
	new ActionBarClient(new FrameSuppression(new FramePoolManager(frameFactory))),
	new ControllerInputClient(
		events,
		new Frame("navigation-input", new FramePoolManager(frameFactory)),
	),
	scheduler,
	new TalentsClient(),
);
