import type { IControllerOptionsClient } from "../../clients/controller-options-client";
import { ControllerOptionsMenuAction } from "../../clients/controller-options-menu-action";
import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../../ui/frame-pool-manager";
import type { IUIOrchestrator } from "../../ui/ui-orchestrator";
import type { ModuleManager } from "../module-manager";
import { ControllerOptionsModule } from "./controller-options-module";
import { ControllerOptionsPanel } from "./controller-options-panel";

export function registerControllerOptions(
	pool: IFramePoolManager,
	events: IEventBus,
	ui: IUIOrchestrator,
	modules: ModuleManager,
	client: IControllerOptionsClient,
) {
	const panel = new ControllerOptionsPanel(pool, client, () =>
		ui.closePanel("fullscreen", undefined, "controller-options"),
	);
	modules.register(new ControllerOptionsModule(ui, events, panel));
	return { panel, menuAction: new ControllerOptionsMenuAction(events) };
}
