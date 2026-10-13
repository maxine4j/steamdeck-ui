import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { CollectionsClient } from "./collections-client";

afterEach(() => vi.unstubAllGlobals());

it("coordinates one window suppressor across mounts and toys and restores unsupported tabs", () => {
	let selected = "mounts";
	const hooks: (() => void)[] = [];
	const journal = {
		IsShown: () => true,
		HookScript: (_script: string, callback: () => void) => hooks.push(callback),
	};
	vi.stubGlobal("CollectionsJournal", journal);
	for (const [global, tab] of [
		["MountJournal", "mounts"],
		["ToyBox", "toys"],
		["PetJournal", "pets"],
	])
		vi.stubGlobal(global, {
			IsShown: () => selected === tab,
			HookScript: journal.HookScript,
		});
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	vi.stubGlobal("HideUIPanel", vi.fn());
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const mounts = vi.fn(),
		toys = vi.fn();
	events.subscribe("MOUNTS_VISIBILITY_CHANGED", mounts);
	events.subscribe("TOYS_VISIBILITY_CHANGED", toys);
	const client = new CollectionsClient(frames, events);
	client.disable("mounts");
	client.disable("toys");
	frames.restore.mockClear();
	selected = "toys";
	for (const hook of hooks) hook();
	expect(frames.restore).not.toHaveBeenCalled();
	expect(client.isOpen("toys")).toBe(true);
	expect(client.isOpen("mounts")).toBe(false);
	client.restore("mounts");
	expect(frames.restore).not.toHaveBeenCalled();
	selected = "pets";
	hooks.at(0)?.();
	expect(frames.restore).toHaveBeenCalledOnce();
	client.restore("toys");
	const calls = toys.mock.calls.length;
	selected = "toys";
	hooks.at(0)?.();
	expect(toys).toHaveBeenCalledTimes(calls);
	client.disable("toys");
	expect(hooks).toHaveLength(8);
	client.close();
	expect(HideUIPanel).toHaveBeenCalledExactlyOnceWith(journal);
});

it("suppresses pets through the shared owner and publishes visibility", () => {
	const journal = { IsShown: () => true, HookScript: vi.fn() };
	for (const name of [
		"CollectionsJournal",
		"MountJournal",
		"ToyBox",
		"PetJournal",
	])
		vi.stubGlobal(name, journal);
	vi.stubGlobal("C_AddOns", { LoadAddOn: vi.fn() });
	const frames = { suppress: vi.fn(), restore: vi.fn() };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("PETS_VISIBILITY_CHANGED", changed);
	const client = new CollectionsClient(frames, events);
	client.disable("pets");
	expect(client.isOpen("pets")).toBe(true);
	expect(frames.suppress).toHaveBeenCalledExactlyOnceWith([journal]);
	expect(changed).toHaveBeenCalledOnce();
	client.restore("pets");
	expect(frames.restore).toHaveBeenCalledOnce();
});
