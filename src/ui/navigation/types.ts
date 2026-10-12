export interface INavigable {
	navId: string;
	/** Logical column; gaps are explicit because Lua arrays cannot retain holes. */
	navColumn?: number;
	onFocus(): void;
	onBlur(): void;
	onInteract(): void; // Maps to A button
}

export type NavGrid = INavigable[][];
export type NavDirection = "up" | "down" | "left" | "right";
