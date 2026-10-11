import type { IUIComponent } from "../components/types";
import type { INavigable } from "../navigation/types";

export type DockPosition = "left" | "right" | "fullscreen";

export interface IPanel {
	id: string;
	title: string;
	readonly icon?: number;

	// Lifecycle hooks
	onMount(parentComponent: IUIComponent): void;
	onUnmount(): void;

	// Returns the D-Pad routable elements for this panel
	getNavGrid(): INavigable[][];
}

export interface IPanelContainer {
	id: string;
	position: DockPosition;
	registerPanel(panel: IPanel): void;

	pushPanel(panel: IPanel): void;
	popPanel(): void;
	swapPanel(panel: IPanel): void;

	// Cascades the active panel's grid to the NavManager
	focus(): void;
}
