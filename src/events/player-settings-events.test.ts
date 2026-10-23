import { expect, it, vi } from "vitest";
import type { WowEventFrame } from "../types";
import { WowEventBus } from "./wow-event-bus";

it("translates PvP, loot, difficulty, leadership, and instance state into player settings refreshes", () => {
	let dispatch: (frame: WowEventFrame, event: string, unit?: string) => void =
		() => {};
	const frame = {
		Hide: vi.fn(),
		RegisterEvent: vi.fn(),
		SetScript: (_script: string, handler: typeof dispatch) => {
			dispatch = handler;
		},
	} as unknown as WowEventFrame;
	const bus = new WowEventBus({ createEventFrame: () => frame });
	const changed = vi.fn();
	bus.subscribe("PLAYER_SETTINGS_CHANGED", changed);
	const events = [
		"PLAYER_FLAGS_CHANGED",
		"PVP_TIMER_UPDATE",
		"PLAYER_LOOT_SPEC_UPDATED",
		"PLAYER_DIFFICULTY_CHANGED",
		"GROUP_ROSTER_UPDATE",
		"PARTY_LEADER_CHANGED",
		"PLAYER_ENTERING_WORLD",
		"WAR_MODE_STATUS_UPDATE",
		"ACTIVE_PLAYER_SPECIALIZATION_CHANGED",
		"PLAYER_ROLES_ASSIGNED",
		"ROLE_CHANGED_INFORM",
		"GARRISON_USE_PARTY_GARRISON_CHANGED",
	];
	for (const event of events) {
		expect(frame.RegisterEvent).toHaveBeenCalledWith(event);
		dispatch(frame, event, "player");
	}
	expect(changed).toHaveBeenCalledTimes(events.length);
	dispatch(frame, "PLAYER_FLAGS_CHANGED", "target");
	expect(changed).toHaveBeenCalledTimes(events.length);
});
