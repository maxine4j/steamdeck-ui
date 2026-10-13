import type { IEventBus } from "../../events/types";
export interface IBuiltInTitles {
	disable(): void;
	restore(): void;
}
export class BuiltInTitles implements IBuiltInTitles {
	private enabled = false;
	private hooked = false;
	constructor(private readonly events: IEventBus) {}
	disable(): void {
		if (!this.hooked) {
			// Titles is native Paper Doll sidebar 2, not a Character subframe.
			const hook = hooksecurefunc as unknown as (
				this: void,
				name: string,
				callback: (this: void, frame: unknown, index: number) => void,
			) => void;
			hook("PaperDollFrame_SetSidebar", (_frame, index) => {
				if (
					this.enabled &&
					index === 2 &&
					CharacterFrame.IsShown() &&
					CharacterFrame.activeSubframe === "PaperDollFrame"
				)
					this.events.emit("TITLES_OPEN");
			});
			this.hooked = true;
		}
		this.enabled = true;
	}
	restore(): void {
		this.enabled = false;
	}
}
