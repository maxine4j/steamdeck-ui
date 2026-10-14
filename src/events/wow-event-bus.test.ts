import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { createTestEventBus } from "./test-event-bus";
import { WowEventBus } from "./wow-event-bus";

it("registers and delivers native bank lifecycle, tab and warband money updates", () => {
	let dispatch: (frame: WowEventFrame, event: string) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	for (const event of [
		"BANKFRAME_OPENED",
		"BANKFRAME_CLOSED",
		"BANK_TABS_CHANGED",
		"ACCOUNT_MONEY",
	] as const) {
		const handler = vi.fn();
		bus.subscribe(event, handler);
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
		expect(handler).toHaveBeenCalledOnce();
	}
});

it("delivers bank slot and lock changes even without a carried-bag delayed update", () => {
	let dispatch: (frame: WowEventFrame, event: string) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const changed = vi.fn();
	bus.subscribe("BANK_CONTENTS_CHANGED", changed);
	for (const event of [
		"BAG_UPDATE",
		"PLAYERBANKSLOTS_CHANGED",
		"PLAYER_ACCOUNT_BANK_TAB_SLOTS_CHANGED",
		"ITEM_LOCK_CHANGED",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(changed).toHaveBeenCalledTimes(4);
});

it("preserves collection IDs for targeted cache refreshes", () => {
	let dispatch: (
		frame: WowEventFrame,
		event: string,
		...args: unknown[]
	) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const mounts = vi.fn(),
		toys = vi.fn(),
		pets = vi.fn(),
		achievements = vi.fn(),
		items = vi.fn();
	bus.subscribe("MOUNTS_CHANGED", mounts);
	bus.subscribe("TOYS_CHANGED", toys);
	bus.subscribe("PETS_CHANGED", pets);
	bus.subscribe("ACHIEVEMENTS_CHANGED", achievements);
	bus.subscribe("ITEM_DATA_LOAD_RESULT", items);
	dispatch(frame, "NEW_MOUNT_ADDED", 42);
	dispatch(frame, "TOYS_UPDATED", 99, true);
	dispatch(frame, "ACHIEVEMENT_EARNED", 123);
	dispatch(frame, "ITEM_DATA_LOAD_RESULT", 99, true);
	expect(mounts).toHaveBeenCalledWith({ id: 42 });
	expect(toys).toHaveBeenCalledWith({ id: 99 });
	for (const event of [
		"PET_JOURNAL_LIST_UPDATE",
		"NEW_PET_ADDED",
		"PET_JOURNAL_PET_DELETED",
		"PET_JOURNAL_PET_REVOKED",
		"PET_JOURNAL_PET_RESTORED",
	])
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
	dispatch(frame, "NEW_PET_ADDED", "BattlePet-1");
	expect(pets).toHaveBeenCalledWith(undefined);
	dispatch(frame, "PET_JOURNAL_LIST_UPDATE");
	expect(pets).toHaveBeenCalledTimes(2);
	expect(achievements).toHaveBeenCalledWith({ id: 123 });
	expect(items).toHaveBeenCalledWith({ id: 99, success: true });
});

it("separates structural ring events from cooldown refreshes and filters pet unit events", () => {
	let dispatch: (
		frame: WowEventFrame,
		event: string,
		...args: unknown[]
	) => void = () => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: vi.fn((_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		}),
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const contents = vi.fn();
	bus.subscribe("ACTION_RING_CONTENTS_CHANGED", contents);
	for (const event of [
		"PET_BAR_UPDATE",
		"UPDATE_SHAPESHIFT_FORMS",
		"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
		"QUEST_LOG_UPDATE",
		"QUEST_WATCH_LIST_CHANGED",
		"BAG_UPDATE_DELAYED",
		"SPELLS_CHANGED",
		"ZONE_CHANGED_NEW_AREA",
		"UPDATE_EXTRA_ACTIONBAR",
		"ITEM_DATA_LOAD_RESULT",
		"QUEST_ITEM_UPDATE",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		const before = contents.mock.calls.length;
		dispatch(frame, event);
		expect(contents).toHaveBeenCalledTimes(before + 1);
	}
	expect(frame.RegisterEvent).toHaveBeenCalledWith("UNIT_PET");
	contents.mockClear();
	dispatch(frame, "UNIT_PET", "party1");
	dispatch(frame, "ACTIONBAR_UPDATE_COOLDOWN");
	dispatch(frame, "SPELL_UPDATE_COOLDOWN");
	expect(contents).not.toHaveBeenCalled();
	dispatch(frame, "UNIT_PET", "player");
	expect(contents).toHaveBeenCalledOnce();
});

it("forwards native login events through the hidden event frame", () => {
	let dispatch: (
		frame: WowEventFrame,
		event: string,
		...args: unknown[]
	) => void = () => {};
	const frame: WowEventFrame = {
		Hide: vi.fn(),
		Show: vi.fn(),
		SetParent: vi.fn(),
		ClearAllPoints: vi.fn(),
		SetPoint: vi.fn(),
		SetSize: vi.fn(),
		CreateTexture: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: vi.fn((_script, handler) => {
			dispatch = handler;
		}),
	};
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const login = vi.fn();
	const achievements = vi.fn();
	bus.subscribe("ACHIEVEMENTS_CHANGED", achievements);
	for (const event of [
		"ACHIEVEMENT_EARNED",
		"CRITERIA_UPDATE",
		"RECEIVED_ACHIEVEMENT_LIST",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(achievements).toHaveBeenCalledTimes(3);
	bus.subscribe("PLAYER_LOGIN", login);
	const mounts = vi.fn();
	const mountSearch = vi.fn();
	bus.subscribe("MOUNTS_CHANGED", mounts);
	bus.subscribe("MOUNTS_SEARCH_CHANGED", mountSearch);
	dispatch(frame, "MOUNT_JOURNAL_SEARCH_UPDATED");
	expect(mountSearch).toHaveBeenCalledOnce();
	expect(mounts).not.toHaveBeenCalled();
	dispatch(frame, "COMPANION_LEARNED", "MOUNT");
	expect(mounts).toHaveBeenCalledOnce();
	dispatch(frame, "COMPANION_UPDATE", "MOUNT");
	dispatch(frame, "MOUNT_JOURNAL_USABILITY_CHANGED");
	dispatch(frame, "PLAYER_REGEN_ENABLED");
	expect(mounts).toHaveBeenCalledOnce();
	expect(frame.Hide).toHaveBeenCalledOnce();
	expect(frame.RegisterEvent).toHaveBeenCalledWith("PLAYER_LOGIN");
	dispatch(frame, "OTHER_EVENT");
	expect(login).not.toHaveBeenCalled();
	dispatch(frame, "PLAYER_LOGIN");
	expect(login).toHaveBeenCalledOnce();
	for (const event of [
		"MERCHANT_SHOW",
		"MERCHANT_CLOSED",
		"MERCHANT_UPDATE",
		"MERCHANT_FILTER_ITEM_UPDATE",
		"GUILDBANK_UPDATE_MONEY",
		"GUILDBANK_UPDATE_WITHDRAWMONEY",
	] as const) {
		const callback = vi.fn();
		bus.subscribe(event, callback);
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
		expect(callback).toHaveBeenCalledOnce();
	}
	const bagUpdate = vi.fn();
	const toys = vi.fn();
	const toyCooldown = vi.fn();
	bus.subscribe("TOYS_CHANGED", toys);
	bus.subscribe("TOYS_COOLDOWN_CHANGED", toyCooldown);
	expect(frame.RegisterEvent).toHaveBeenCalledWith("TOYS_UPDATED");
	dispatch(frame, "TOYS_UPDATED");
	expect(toys).toHaveBeenCalledOnce();
	dispatch(frame, "SPELL_UPDATE_COOLDOWN");
	expect(toyCooldown).toHaveBeenCalledOnce();
	bus.subscribe("BAG_UPDATE_DELAYED", bagUpdate);
	expect(frame.RegisterEvent).toHaveBeenCalledWith("BAG_UPDATE_DELAYED");
	dispatch(frame, "BAG_UPDATE_DELAYED");
	expect(bagUpdate).toHaveBeenCalledOnce();
	const finderUpdate = vi.fn();
	const currencyUpdate = vi.fn();
	bus.subscribe("CURRENCY_CHANGED", currencyUpdate);
	for (const event of [
		"CURRENCY_DISPLAY_UPDATE",
		"ACCOUNT_CHARACTER_CURRENCY_DATA_RECEIVED",
		"CURRENCY_TRANSFER_SUCCESS",
		"CURRENCY_TRANSFER_FAILED",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(currencyUpdate).toHaveBeenCalledTimes(4);
	bus.subscribe("DUNGEON_FINDER_CHANGED", finderUpdate);
	for (const event of [
		"LFG_UPDATE_RANDOM_INFO",
		"LFG_ROLE_UPDATE",
		"LFG_UPDATE",
		"LFG_LOCK_INFO_RECEIVED",
		"LFG_COOLDOWNS_UPDATED",
		"GROUP_ROSTER_UPDATE",
		"UPDATE_BATTLEFIELD_STATUS",
		"PVP_ROLE_UPDATE",
		"PVP_TYPES_ENABLED",
		"PVP_RATED_STATS_UPDATE",
		"PVP_REWARDS_UPDATE",
		"PVP_BRAWL_INFO_UPDATED",
		"PLAYER_AVG_ITEM_LEVEL_UPDATE",
		"GET_ITEM_INFO_RECEIVED",
		"PVPQUEUE_ANYWHERE_UPDATE_AVAILABLE",
		"PLAYER_LEVEL_UP",
		"PLAYER_SPECIALIZATION_CHANGED",
		"LFG_LIST_ACTIVE_ENTRY_UPDATE",
		"LFG_LIST_SEARCH_RESULT_UPDATED",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(finderUpdate).toHaveBeenCalledTimes(19);
	const opened = vi.fn();
	const closed = vi.fn();
	bus.subscribe("BAG_OPEN", opened);
	bus.subscribe("BAG_CLOSED", closed);
	expect(frame.RegisterEvent).toHaveBeenCalledWith("BAG_OPEN");
	expect(frame.RegisterEvent).toHaveBeenCalledWith("BAG_CLOSED");
	dispatch(frame, "BAG_OPEN");
	dispatch(frame, "BAG_CLOSED");
	expect(opened).toHaveBeenCalledOnce();
	expect(closed).toHaveBeenCalledOnce();
	for (const event of ["PLAYER_MONEY", "ITEM_DATA_LOAD_RESULT"] as const) {
		const handler = vi.fn();
		bus.subscribe(event, handler);
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
		expect(handler).toHaveBeenCalledOnce();
	}
	const stats = vi.fn();
	const model = vi.fn();
	const equipment = vi.fn();
	bus.subscribe("CHARACTER_STATS_CHANGED", stats);
	bus.subscribe("CHARACTER_MODEL_CHANGED", model);
	bus.subscribe("PLAYER_EQUIPMENT_CHANGED", equipment);
	dispatch(frame, "UNIT_STATS", "target");
	expect(stats).not.toHaveBeenCalled();
	dispatch(frame, "UNIT_STATS", "player");
	dispatch(frame, "COMBAT_RATING_UPDATE");
	expect(stats).toHaveBeenCalledTimes(2);
	dispatch(frame, "UNIT_MODEL_CHANGED", "target");
	expect(model).not.toHaveBeenCalled();
	dispatch(frame, "UNIT_MODEL_CHANGED", "player");
	expect(model).toHaveBeenCalledOnce();
	expect(frame.RegisterEvent).toHaveBeenCalledWith("UNIT_PORTRAIT_UPDATE");
	expect(frame.RegisterEvent).toHaveBeenCalledWith("PORTRAITS_UPDATED");
	dispatch(frame, "UNIT_PORTRAIT_UPDATE", "target");
	expect(model).toHaveBeenCalledOnce();
	dispatch(frame, "UNIT_PORTRAIT_UPDATE", "player");
	dispatch(frame, "PORTRAITS_UPDATED");
	expect(model).toHaveBeenCalledTimes(3);
	dispatch(frame, "PLAYER_EQUIPMENT_CHANGED", 1, true);
	expect(equipment).toHaveBeenCalledOnce();
	const reputation = vi.fn(),
		titles = vi.fn();
	bus.subscribe("REPUTATION_CHANGED", reputation);
	bus.subscribe("TITLES_CHANGED", titles);
	for (const event of [
		"UPDATE_FACTION",
		"MAJOR_FACTION_RENOWN_LEVEL_CHANGED",
		"MAJOR_FACTION_UNLOCKED",
		"QUEST_LOG_UPDATE",
	])
		dispatch(frame, event);
	expect(reputation).toHaveBeenCalledTimes(4);
	dispatch(frame, "KNOWN_TITLES_UPDATE");
	dispatch(frame, "UNIT_NAME_UPDATE", "target");
	expect(titles).toHaveBeenCalledOnce();
	dispatch(frame, "UNIT_NAME_UPDATE", "player");
	expect(titles).toHaveBeenCalledTimes(2);
	const actions = vi.fn(),
		combatEnded = vi.fn();
	bus.subscribe("ACTION_BAR_CHANGED", actions);
	bus.subscribe("COMBAT_ENDED", combatEnded);
	for (const event of [
		"SPELLS_CHANGED",
		"UPDATE_EXTRA_ACTIONBAR",
		"ZONE_CHANGED_NEW_AREA",
		"ACTIONBAR_SLOT_CHANGED",
		"ACTIONBAR_UPDATE_COOLDOWN",
		"SPELL_UPDATE_COOLDOWN",
		"SPELL_UPDATE_CHARGES",
		"UPDATE_MACROS",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(actions).toHaveBeenCalledTimes(8);
	dispatch(frame, "UNIT_AURA", "target");
	expect(actions).toHaveBeenCalledTimes(8);
	dispatch(frame, "UNIT_AURA", "player");
	expect(actions).toHaveBeenCalledTimes(9);
	dispatch(frame, "PLAYER_REGEN_ENABLED");
	expect(combatEnded).toHaveBeenCalledOnce();
	const cursor = vi.fn();
	bus.subscribe("ACTION_BAR_CURSOR_CHANGED", cursor);
	for (const event of [
		"CURSOR_CHANGED",
		"ACTIONBAR_SHOWGRID",
		"ACTIONBAR_HIDEGRID",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(cursor).toHaveBeenCalledTimes(3);
	const talents = vi.fn();
	bus.subscribe("TALENTS_CHANGED", talents);
	for (const event of [
		"TRAIT_CONFIG_CREATED",
		"TRAIT_CONFIG_UPDATED",
		"TRAIT_CONFIG_DELETED",
		"TRAIT_CONFIG_LIST_UPDATED",
		"ACTIVE_COMBAT_CONFIG_CHANGED",
		"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
		"SELECTED_LOADOUT_CHANGED",
		"CONFIG_COMMIT_FAILED",
		"STARTER_BUILD_ACTIVATION_FAILED",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event);
	}
	expect(talents).toHaveBeenCalledTimes(9);
	dispatch(frame, "PLAYER_SPECIALIZATION_CHANGED", "target");
	expect(talents).toHaveBeenCalledTimes(9);
	dispatch(frame, "PLAYER_SPECIALIZATION_CHANGED", "player");
	expect(talents).toHaveBeenCalledTimes(10);
	const identity = vi.fn();
	bus.subscribe("CHARACTER_IDENTITY_CHANGED", identity);
	for (const event of [
		"UNIT_NAME_UPDATE",
		"UNIT_LEVEL",
		"PLAYER_GUILD_UPDATE",
		"PLAYER_SPECIALIZATION_CHANGED",
	]) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event, "target");
		expect(identity).not.toHaveBeenCalled();
	}
	for (const event of [
		"UNIT_NAME_UPDATE",
		"UNIT_LEVEL",
		"PLAYER_GUILD_UPDATE",
		"PLAYER_SPECIALIZATION_CHANGED",
	])
		dispatch(frame, event, "player");
	dispatch(frame, "GUILD_ROSTER_UPDATE");
	dispatch(frame, "PLAYER_ENTERING_WORLD");
	dispatch(frame, "ACTIVE_PLAYER_SPECIALIZATION_CHANGED");
	expect(identity).toHaveBeenCalledTimes(7);
});

it("deduplicates subscriptions and removes unsubscribed handlers", () => {
	const bus = createTestEventBus();
	const handler = vi.fn();
	bus.subscribe("PLAYER_LOGIN", handler);
	bus.subscribe("PLAYER_LOGIN", handler);
	bus.emit("PLAYER_LOGIN");
	expect(handler).toHaveBeenCalledOnce();
	bus.unsubscribe("PLAYER_LOGIN", handler);
	bus.emit("PLAYER_LOGIN");
	expect(handler).toHaveBeenCalledOnce();
});

it("finishes dispatching its snapshot when subscriptions change", () => {
	const bus = createTestEventBus();
	const later = vi.fn();
	const removed = vi.fn();
	bus.subscribe("PLAYER_LOGIN", () => {
		bus.unsubscribe("PLAYER_LOGIN", removed);
		bus.subscribe("PLAYER_LOGIN", later);
	});
	bus.subscribe("PLAYER_LOGIN", removed);
	bus.emit("PLAYER_LOGIN");
	expect(removed).toHaveBeenCalledOnce();
	expect(later).not.toHaveBeenCalled();
	bus.emit("PLAYER_LOGIN");
	expect(removed).toHaveBeenCalledOnce();
	expect(later).toHaveBeenCalledOnce();
});
