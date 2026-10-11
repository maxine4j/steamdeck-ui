import type { WowEventFrame } from "../types";
import { EventBus } from "./event-bus";
export interface EventFrameFactory {
	createEventFrame(): WowEventFrame;
}
const characterStatEvents = [
	"COMBAT_RATING_UPDATE",
	"MASTERY_UPDATE",
	"SPEED_UPDATE",
	"LIFESTEAL_UPDATE",
	"AVOIDANCE_UPDATE",
	"PLAYER_AVG_ITEM_LEVEL_UPDATE",
	"PLAYER_TALENT_UPDATE",
	"ACTIVE_TALENT_GROUP_CHANGED",
	"SPELL_POWER_CHANGED",
	"PLAYER_ENTERING_WORLD",
];
const characterUnitEvents = [
	"UNIT_STATS",
	"UNIT_MAXHEALTH",
	"UNIT_AURA",
	"UNIT_DAMAGE",
	"UNIT_ATTACK_SPEED",
	"UNIT_LEVEL",
];
/** Owns the hidden event frame; modules only see IEventBus. */
export class WowEventBus extends EventBus {
	private readonly frame: WowEventFrame;
	constructor(factory: EventFrameFactory) {
		super();
		this.frame = factory.createEventFrame();
		this.frame.Hide();
		this.frame.RegisterEvent("PLAYER_LOGIN");
		this.frame.RegisterEvent("BAG_UPDATE_DELAYED");
		this.frame.RegisterEvent("BAG_OPEN");
		this.frame.RegisterEvent("BAG_CLOSED");
		this.frame.RegisterEvent("PLAYER_MONEY");
		this.frame.RegisterEvent("ITEM_DATA_LOAD_RESULT");
		this.frame.RegisterEvent("PLAYER_EQUIPMENT_CHANGED");
		this.frame.RegisterEvent("UNIT_MODEL_CHANGED");
		for (const event of [...characterStatEvents, ...characterUnitEvents])
			this.frame.RegisterEvent(event);
		this.frame.SetScript("OnEvent", (_frame, event, unit) => {
			if (event === "PLAYER_EQUIPMENT_CHANGED")
				this.emit("PLAYER_EQUIPMENT_CHANGED");
			else if (event === "UNIT_MODEL_CHANGED" && unit === "player")
				this.emit("CHARACTER_MODEL_CHANGED");
			else if (
				characterStatEvents.includes(event) ||
				(characterUnitEvents.includes(event) && unit === "player")
			)
				this.emit("CHARACTER_STATS_CHANGED");
			if (
				event === "PLAYER_LOGIN" ||
				event === "BAG_UPDATE_DELAYED" ||
				event === "BAG_OPEN" ||
				event === "BAG_CLOSED" ||
				event === "PLAYER_MONEY" ||
				event === "ITEM_DATA_LOAD_RESULT"
			)
				this.emit(event);
		});
	}
}
