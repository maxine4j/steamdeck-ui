export interface INavigable {
	/** Hardware bindings for protected actions; never dispatch these via Click(). */
	secureActions?(): SecureNavigationActions;
	navId: string;
	/** Logical column; gaps are explicit because Lua arrays cannot retain holes. */
	navColumn?: number;
	/** Resolve current item data when focus or the navigation graph refreshes. */
	tooltipItem?(): TooltipContent | undefined;
	/** Refresh restores presentation without revealing an unchanged focus again. */
	onFocus(refresh?: boolean): void;
	/** Shared viewport identity and generic scrolling operations for this control. */
	navigationScroll?: { scrollToEdge(direction: "up" | "down"): void };
	onBlur(): void;
	onInteract(): void; // Maps to A button
	onContext?(): void; // Maps to Y button
	onAlternate?(): void; // Maps to X button
	/** Continuous controls consume directional input while retaining focus. */
	onMove?(direction: NavDirection, pressed: boolean): void;
}

export type NavGrid = INavigable[][];
export type NavDirection = "up" | "down" | "left" | "right";

import type { Frame } from "../components/frame";
import type { TooltipContent } from "../components/tooltip-content";

export interface SecureNavigationActions {
	interact?: Frame;
	alternate?: Frame;
}
