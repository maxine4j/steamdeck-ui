import type { IEventBus } from "../events/types";
import type { NativeGameMenuAction } from "./native-dialogs-client";
export class ControllerOptionsMenuAction implements NativeGameMenuAction {
	readonly label = "SteamDeck UI options";
	constructor(private readonly events: IEventBus) {}
	activate(): void {
		const menu = (
			_G as unknown as { GameMenuFrame?: Parameters<typeof HideUIPanel>[0] }
		).GameMenuFrame;
		if (menu) HideUIPanel(menu);
		this.events.emit("CONTROLLER_OPTIONS_OPEN_REQUESTED");
	}
}
