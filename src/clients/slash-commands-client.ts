import type { IEventBus } from "../events/types";

// Blizzard UI globals are not included in the generated API declarations.
declare global {
	const SlashCmdList: Record<
		string,
		((this: void, message: string) => void) | undefined
	>;
	function ReloadUI(this: void): void;
}

export interface ISlashCommandsClient {
	initialize(): void;
	shutdown(): void;
}

export class SlashCommandsClient implements ISlashCommandsClient {
	constructor(private readonly events?: IEventBus) {}
	initialize(): void {
		(_G as unknown as Record<string, unknown>).SLASH_STEAMDECKUI1 = "/sdui";
		SlashCmdList.STEAMDECKUI = (message) => {
			if (message.trim().toLowerCase() === "debug")
				this.events?.emit("DEBUG_OPEN_REQUESTED");
		};
		(_G as unknown as Record<string, unknown>).SLASH_STEAMDECKUI_RELOAD1 =
			"/rl";
		SlashCmdList.STEAMDECKUI_RELOAD = () => ReloadUI();
	}
	shutdown(): void {
		SlashCmdList.STEAMDECKUI = undefined;
		(_G as unknown as Record<string, unknown>).SLASH_STEAMDECKUI1 = undefined;
		SlashCmdList.STEAMDECKUI_RELOAD = undefined;
		(_G as unknown as Record<string, unknown>).SLASH_STEAMDECKUI_RELOAD1 =
			undefined;
	}
}
