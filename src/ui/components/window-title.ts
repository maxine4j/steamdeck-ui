import type { Frame } from "./frame";

/** Matches Blizzard's metal frame title bar: GameFontNormal at TOP -6. */
export function setWindowTitle(frame: Frame, title: string): void {
	frame.setLabel("window-title", title, "TOP", 0, -6, 12);
}
