import { afterEach, expect, it, vi } from "vitest";
import { createTestEventBus } from "../events/test-event-bus";
import { BuiltInCurrency } from "../modules/currency/built-in-currency";
import { CurrencyModule } from "../modules/currency/currency-module";
import { BuiltInPaperDoll } from "../modules/paper-doll/built-in-paper-doll";
import { PaperDollModule } from "../modules/paper-doll/paper-doll-module";
import { CharacterFrameClient } from "./character-frame-client";

afterEach(() => vi.unstubAllGlobals());
it("routes native tab input into simultaneous module panels on opposite docks", () => {
	let shown = false;
	const frame = { IsShown: () => shown, activeSubframe: "PaperDollFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const fire = () => {
		for (const hook of hooks) hook();
	};
	vi.stubGlobal("ToggleCharacter", (tab: string) => {
		shown = true;
		frame.activeSubframe = tab;
		fire();
	});
	vi.stubGlobal("HideUIPanel", () => {
		shown = false;
		fire();
	});
	const events = createTestEventBus();
	const client = new CharacterFrameClient(
		{ suppress: vi.fn(), restore: vi.fn() },
		events,
	);
	const docks = new Map<string, string>();
	const ui = {
		openPanel: (id: string, dock: string) => {
			docks.set(dock, id);
		},
		closePanel: (dock: string, id?: string) => {
			if (id === undefined || docks.get(dock) === id) docks.delete(dock);
		},
	};
	const paper = new PaperDollModule(
		ui,
		events,
		{
			getIdentity: () => ({
				name: "Player",
				level: 80,
				race: "Human",
				className: "Mage",
			}),
			getEquipment: () => [],
			getStats: () => [],
		},
		{
			setIdentity: vi.fn(),
			setEquipment: vi.fn(),
			setStats: vi.fn(),
			refreshPreview: vi.fn(),
			refreshTitles: vi.fn(),
			showTitles: vi.fn(),
		},
		new BuiltInPaperDoll(client),
		{ nextFrame: () => vi.fn() },
		{ disable: vi.fn(), restore: vi.fn() },
	);
	const currency = new CurrencyModule(
		ui,
		events,
		{ refresh: vi.fn(), closeOptions: vi.fn(), transferResult: vi.fn() },
		new BuiltInCurrency(client),
	);
	paper.disableBuiltIn();
	paper.initialize();
	currency.disableBuiltIn();
	currency.initialize();
	client.open("PaperDollFrame");
	client.open("TokenFrame");
	expect([...docks.entries()]).toEqual([
		["left", "paper-doll"],
		["right", "currency"],
	]);
	client.close("PaperDollFrame");
	expect([...docks.entries()]).toEqual([["right", "currency"]]);
	client.open("PaperDollFrame");
	client.close("TokenFrame");
	expect([...docks.entries()]).toEqual([["left", "paper-doll"]]);
	paper.shutdown();
	currency.shutdown();
});
it("keeps opposite dock tabs open and closes each independently", () => {
	let shown = true;
	const frame = { IsShown: () => shown, activeSubframe: "PaperDollFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const fire = () => {
		for (const hook of hooks) hook();
	};
	vi.stubGlobal("ToggleCharacter", (tab: string) => {
		frame.activeSubframe = tab;
		shown = true;
		fire();
	});
	const hide = vi.fn(() => {
		shown = false;
		fire();
	});
	vi.stubGlobal("HideUIPanel", hide);
	const client = new CharacterFrameClient(
		{ suppress: vi.fn(), restore: vi.fn() },
		createTestEventBus(),
	);
	client.enable("PaperDollFrame", "CHARACTER_VISIBILITY_CHANGED", "left");
	client.enable("ReputationFrame", "REPUTATION_VISIBILITY_CHANGED", "left");
	client.enable("TokenFrame", "CURRENCY_VISIBILITY_CHANGED", "right");
	client.open("TokenFrame");
	expect(client.isOpen("PaperDollFrame")).toBe(true);
	expect(client.isOpen("TokenFrame")).toBe(true);
	client.close("TokenFrame");
	expect(client.isOpen("PaperDollFrame")).toBe(true);
	expect(client.isOpen("TokenFrame")).toBe(false);
	expect(hide).not.toHaveBeenCalled();
	client.open("TokenFrame");
	client.open("ReputationFrame");
	expect(client.isOpen("PaperDollFrame")).toBe(false);
	expect(client.isOpen("ReputationFrame")).toBe(true);
	expect(client.isOpen("TokenFrame")).toBe(true);
	client.close("ReputationFrame");
	expect(client.isOpen("TokenFrame")).toBe(true);
	expect(hide).not.toHaveBeenCalled();
	client.close("TokenFrame");
	expect(hide).toHaveBeenCalledOnce();
	expect(client.isOpen("TokenFrame")).toBe(false);
});
it("owns suppression once, ignores nested native hooks and keeps replacement tab switches hidden", () => {
	let shown = true;
	const frame = { IsShown: () => shown, activeSubframe: "TokenFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const fire = () => {
		for (const hook of hooks) hook();
	};
	// Native reparenting invokes child OnHide, which calls hooked HideUIPanel.
	const suppression = { suppress: vi.fn(fire), restore: vi.fn(fire) };
	const events = createTestEventBus();
	const changed = vi.fn();
	events.subscribe("CURRENCY_VISIBILITY_CHANGED", changed);
	const client = new CharacterFrameClient(suppression, events);
	client.enable("PaperDollFrame", "CHARACTER_VISIBILITY_CHANGED");
	client.enable("ReputationFrame", "REPUTATION_VISIBILITY_CHANGED");
	client.enable("TokenFrame", "CURRENCY_VISIBILITY_CHANGED");
	expect(hooks).toHaveLength(7);
	expect(suppression.suppress).toHaveBeenCalledOnce();
	expect(suppression.restore).not.toHaveBeenCalled();
	changed.mockClear();
	fire();
	fire();
	expect(changed).not.toHaveBeenCalled();
	frame.activeSubframe = "ReputationFrame";
	fire();
	expect(suppression.suppress).toHaveBeenCalledOnce();
	expect(suppression.restore).not.toHaveBeenCalled();
	expect(changed).toHaveBeenCalledOnce();
	shown = false;
	fire();
	expect(suppression.restore).toHaveBeenCalledOnce();
	client.disable("PaperDollFrame");
	client.disable("ReputationFrame");
	client.disable("TokenFrame");
	const calls = changed.mock.calls.length;
	fire();
	expect(changed).toHaveBeenCalledTimes(calls);
});

it("restores unsupported tabs once and keeps active tabs suppressed when other modules stop", () => {
	const frame = { IsShown: () => true, activeSubframe: "PaperDollFrame" };
	vi.stubGlobal("CharacterFrame", frame);
	const hooks: (() => void)[] = [];
	vi.stubGlobal("hooksecurefunc", (...args: unknown[]) =>
		hooks.push(args.at(-1) as () => void),
	);
	const suppression = { suppress: vi.fn(), restore: vi.fn() };
	const client = new CharacterFrameClient(suppression, createTestEventBus());
	client.enable("PaperDollFrame", "CHARACTER_VISIBILITY_CHANGED");
	client.enable("TokenFrame", "CURRENCY_VISIBILITY_CHANGED");
	client.disable("TokenFrame");
	expect(suppression.restore).not.toHaveBeenCalled();
	frame.activeSubframe = "OtherAddonTab";
	for (const hook of hooks) hook();
	expect(suppression.restore).toHaveBeenCalledOnce();
	for (const hook of hooks) hook();
	expect(suppression.restore).toHaveBeenCalledOnce();
	frame.activeSubframe = "PaperDollFrame";
	for (const hook of hooks) hook();
	expect(suppression.suppress).toHaveBeenCalledTimes(2);
	client.disable("PaperDollFrame");
	expect(suppression.restore).toHaveBeenCalledTimes(2);
});
