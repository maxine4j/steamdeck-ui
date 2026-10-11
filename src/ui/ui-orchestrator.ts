import { DockPosition, IPanel, IPanelContainer } from "./panel/types";

export interface IUIOrchestrator {
    getContainer(position: DockPosition): IPanelContainer;
    registerPanel(panel: IPanel): void;
    openPanel(panelId: string, position: DockPosition): void;
}
