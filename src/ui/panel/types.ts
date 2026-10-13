import type { IUIComponent } from "../components/types";
import type { NavGrid } from "../navigation/types";

export type DockPosition = "left" | "right" | "fullscreen";

export interface IPanel {
	id: string;
	title: string;
	readonly icon?: number;

	// Lifecycle hooks
	onMount(parentComponent: IUIComponent): void;
	onUnmount(): void;
	/** Called only when the host closes, including Escape and dock replacement. */
	onContainerClosed?(): void;

	// Returns the D-Pad routable elements for this panel
	getNavGrid(): NavGrid;
	onBack?(): void;
	onPanelCycle?(direction: -1 | 1): void;
	setNavigationChanged?(callback?: (focusId?: string) => void): void;
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
