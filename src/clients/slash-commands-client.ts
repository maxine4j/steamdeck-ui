// Blizzard UI globals are not included in the generated API declarations.
declare global {
	const SlashCmdList: Record<string, ((this: void) => void) | undefined>;
	function ReloadUI(this: void): void;
}

export interface ISlashCommandsClient {
	initialize(): void;
	shutdown(): void;
}

export class SlashCommandsClient implements ISlashCommandsClient {
	initialize(): void {
		(_G as unknown as Record<string, unknown>).SLASH_STEAMDECKUI_RELOAD1 =
			"/rl";
		SlashCmdList.STEAMDECKUI_RELOAD = () => ReloadUI();
	}
	shutdown(): void {
		SlashCmdList.STEAMDECKUI_RELOAD = undefined;
		(_G as unknown as Record<string, unknown>).SLASH_STEAMDECKUI_RELOAD1 =
			undefined;
	}
}
