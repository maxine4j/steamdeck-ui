import { WowEventBus } from "./events/wow-event-bus";
import { startSteamDeckUI } from "./start";
import { WowFrameFactory } from "./ui/wow-frame-factory";

const frameFactory = new WowFrameFactory();
const events = new WowEventBus(frameFactory);
startSteamDeckUI(frameFactory, events);
