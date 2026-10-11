import { IUIComponent } from "../components/types";
import { INavigable } from "../navigation/types";

export type DockPosition = 'left' | 'right' | 'fullscreen';

export interface IPanel {
    id: string;
    title: string;

    // Lifecycle hooks
    onMount(parentComponent: IUIComponent): void;
    onUnmount(): void;

    // Returns the D-Pad routable elements for this panel
    getNavGrid(): INavigable[][];
}

export interface IPanelContainer {
    id: string;
    position: DockPosition;

    pushPanel(panel: IPanel): void;
    popPanel(): void;
    swapPanel(panel: IPanel): void;

    // Cascades the active panel's grid to the NavManager
    focus(): void;
}
