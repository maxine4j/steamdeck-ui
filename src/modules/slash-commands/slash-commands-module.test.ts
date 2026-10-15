import { afterEach, expect, it, vi } from "vitest";
import { SlashCommandsClient } from "../../clients/slash-commands-client";
import { createTestEventBus } from "../../events/test-event-bus";
import { ModuleManager } from "../module-manager";
import { SlashCommandsModule } from "./slash-commands-module";

afterEach(() => vi.unstubAllGlobals());

it("opens diagnostics through /sdui debug and removes the command on shutdown", () => {
	const commands: Record<string, ((message: string) => void) | undefined> = {};
	const globals: Record<string, unknown> = {};
	vi.stubGlobal("SlashCmdList", commands);
	vi.stubGlobal("_G", globals);
	const events = createTestEventBus();
	const open = vi.fn();
	events.subscribe("DEBUG_OPEN_REQUESTED", open);
	const client = new SlashCommandsClient(events);
	client.initialize();
	expect(globals.SLASH_STEAMDECKUI1).toBe("/sdui");
	commands.STEAMDECKUI?.(" debug ");
	expect(open).toHaveBeenCalledOnce();
	client.shutdown();
	expect(commands.STEAMDECKUI).toBeUndefined();
	expect(globals.SLASH_STEAMDECKUI1).toBeUndefined();
});

it("registers /rl on startup, reloads the UI, and removes it on shutdown", () => {
	const commands: Record<string, (() => void) | undefined> = {};
	const globals: Record<string, unknown> = {};
	const reload = vi.fn();
	vi.stubGlobal("SlashCmdList", commands);
	vi.stubGlobal("_G", globals);
	vi.stubGlobal("ReloadUI", reload);
	const modules = new ModuleManager();
	modules.register(new SlashCommandsModule(new SlashCommandsClient()));
	modules.start();
	expect(globals.SLASH_STEAMDECKUI_RELOAD1).toBe("/rl");
	commands.STEAMDECKUI_RELOAD?.();
	expect(reload).toHaveBeenCalledOnce();
	modules.stop();
	expect(commands.STEAMDECKUI_RELOAD).toBeUndefined();
	expect(globals.SLASH_STEAMDECKUI_RELOAD1).toBeUndefined();
});
