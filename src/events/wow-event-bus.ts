import type { WowEventFrame } from "../types";
import type { ApplicationEvent, EventHandler, IEventBus } from "./types";
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
const actionBarEvents = [
	"ACTIONBAR_SLOT_CHANGED",
	"ACTIONBAR_UPDATE_COOLDOWN",
	"SPELL_UPDATE_COOLDOWN",
	"SPELL_UPDATE_CHARGES",
	"UPDATE_MACROS",
	"PLAYER_ENTERING_WORLD",
];
const actionCursorEvents = [
	"CURSOR_CHANGED",
	"ACTIONBAR_SHOWGRID",
	"ACTIONBAR_HIDEGRID",
];
const characterUnitEvents = [
	"UNIT_STATS",
	"UNIT_MAXHEALTH",
	"UNIT_AURA",
	"UNIT_DAMAGE",
	"UNIT_ATTACK_SPEED",
	"UNIT_LEVEL",
];
const reputationEvents = [
	"UPDATE_FACTION",
	"MAJOR_FACTION_RENOWN_LEVEL_CHANGED",
	"MAJOR_FACTION_UNLOCKED",
	"QUEST_LOG_UPDATE",
];
const titleEvents = ["KNOWN_TITLES_UPDATE", "UNIT_NAME_UPDATE"];
const talentEvents = [
	"PLAYER_TALENT_UPDATE",
	"ACTIVE_TALENT_GROUP_CHANGED",
	"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
	"SELECTED_LOADOUT_CHANGED",
	"TRAIT_CONFIG_CREATED",
	"TRAIT_CONFIG_UPDATED",
	"TRAIT_CONFIG_DELETED",
	"TRAIT_CONFIG_LIST_UPDATED",
	"ACTIVE_COMBAT_CONFIG_CHANGED",
	"CONFIG_COMMIT_FAILED",
	"STARTER_BUILD_ACTIVATION_FAILED",
	"PLAYER_ENTERING_WORLD",
];
const mountEvents = [
	"COMPANION_LEARNED",
	"COMPANION_UNLEARNED",
	"COMPANION_UPDATE",
	"MOUNT_JOURNAL_USABILITY_CHANGED",
	"MOUNT_JOURNAL_SEARCH_UPDATED",
	"MOUNT_EQUIPMENT_APPLY_RESULT",
	"PLAYER_REGEN_ENABLED",
];
/** Owns the hidden event frame; modules only see IEventBus. */
export class WowEventBus implements IEventBus {
	private readonly handlers = new Map<ApplicationEvent, EventHandler[]>();

	subscribe(event: ApplicationEvent, handler: EventHandler): void {
		const handlers = this.handlers.get(event) ?? [];
		if (!handlers.includes(handler)) handlers.push(handler);
		this.handlers.set(event, handlers);
	}
	unsubscribe(event: ApplicationEvent, handler: EventHandler): void {
		this.handlers.set(
			event,
			(this.handlers.get(event) ?? []).filter(
				(candidate) => candidate !== handler,
			),
		);
	}
	emit(event: ApplicationEvent): void {
		for (const handler of [...(this.handlers.get(event) ?? [])]) handler();
	}

	private readonly frame: WowEventFrame;
	constructor(factory: EventFrameFactory) {
		this.frame = factory.createEventFrame();
		this.frame.Hide();
		this.frame.RegisterEvent("PLAYER_LOGIN");
		this.frame.RegisterEvent("PLAYER_REGEN_DISABLED");
		this.frame.RegisterEvent("BAG_UPDATE_DELAYED");
		this.frame.RegisterEvent("BAG_OPEN");
		this.frame.RegisterEvent("BAG_CLOSED");
		this.frame.RegisterEvent("PLAYER_MONEY");
		this.frame.RegisterEvent("ITEM_DATA_LOAD_RESULT");
		this.frame.RegisterEvent("PLAYER_EQUIPMENT_CHANGED");
		this.frame.RegisterEvent("UNIT_MODEL_CHANGED");
		for (const event of actionBarEvents) this.frame.RegisterEvent(event);
		for (const event of actionCursorEvents) this.frame.RegisterEvent(event);
		for (const event of [
			...characterStatEvents,
			...characterUnitEvents,
			...reputationEvents,
			...titleEvents,
			...mountEvents,
			...talentEvents,
			"PLAYER_SPECIALIZATION_CHANGED",
		])
			this.frame.RegisterEvent(event);
		this.frame.SetScript("OnEvent", (_frame, event, unit) => {
			if (event === "PLAYER_REGEN_DISABLED") this.emit("COMBAT_STARTED");
			if (actionBarEvents.includes(event)) this.emit("ACTION_BAR_CHANGED");
			if (actionCursorEvents.includes(event))
				this.emit("ACTION_BAR_CURSOR_CHANGED");
			if (event === "PLAYER_REGEN_ENABLED") this.emit("COMBAT_ENDED");
			if (
				talentEvents.includes(event) ||
				(event === "PLAYER_SPECIALIZATION_CHANGED" && unit === "player")
			)
				this.emit("TALENTS_CHANGED");
			if (mountEvents.includes(event)) this.emit("MOUNTS_CHANGED");
			if (reputationEvents.includes(event)) this.emit("REPUTATION_CHANGED");
			if (
				event === "KNOWN_TITLES_UPDATE" ||
				(event === "UNIT_NAME_UPDATE" && unit === "player")
			)
				this.emit("TITLES_CHANGED");
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
