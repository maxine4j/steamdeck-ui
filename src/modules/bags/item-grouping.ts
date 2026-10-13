import type { GroupMode } from "./bag-display";

/** One injected grouping preference shared by carried bags and both banks. */
export class ItemGrouping {
	mode: GroupMode = "category";
	private readonly listeners = new Set<() => void>();
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	toggle(): void {
		this.mode = this.mode === "category" ? "expansion" : "category";
		for (const listener of this.listeners) listener();
	}
}
