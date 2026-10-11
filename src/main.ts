import { CharacterClient } from "./clients/character-client";
import { InventoryClient } from "./clients/inventory-client";
import { WowEventBus } from "./events/wow-event-bus";
import { startSteamDeckUI } from "./start";
import { WowFrameFactory } from "./ui/wow-frame-factory";

const frameFactory = new WowFrameFactory();
const events = new WowEventBus(frameFactory);
const inventory = new InventoryClient();
const character = new CharacterClient();
startSteamDeckUI(frameFactory, events, inventory, character);
