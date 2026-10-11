import { CharacterClient } from "./clients/character-client";
import { InventoryClient } from "./clients/inventory-client";
import { MountsClient } from "./clients/mounts-client";
import { ReputationClient } from "./clients/reputation-client";
import { TitlesClient } from "./clients/titles-client";
import { WowEventBus } from "./events/wow-event-bus";
import { startSteamDeckUI } from "./start";
import { WowFrameFactory } from "./ui/wow-frame-factory";

const frameFactory = new WowFrameFactory();
const events = new WowEventBus(frameFactory);
const inventory = new InventoryClient();
const character = new CharacterClient();
const reputation = new ReputationClient();
const titles = new TitlesClient();
startSteamDeckUI(
	frameFactory,
	events,
	inventory,
	character,
	reputation,
	titles,
	new MountsClient(),
);
