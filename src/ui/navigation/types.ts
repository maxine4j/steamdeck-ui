export interface INavigable {
	navId: string;
	/** Logical column; gaps are explicit because Lua arrays cannot retain holes. */
	navColumn?: number;
	onFocus(): void;
	onBlur(): void;
	onInteract(): void; // Maps to A button
	onContext?(): void; // Maps to Y button
	onAlternate?(): void; // Maps to X button
}

export type NavGrid = INavigable[][];
export type NavDirection = "up" | "down" | "left" | "right";
