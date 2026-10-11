import type { Frame } from "../components/frame";
import type { IUIComponent } from "../components/types";
import type { IPanel } from "./types";
export class Panel implements IPanel {
	constructor(
		public readonly id: string,
		public readonly title: string,
		private readonly frame: Frame,
	) {}
	onMount(parent: IUIComponent): void {
		this.frame.setParent(parent);
		this.frame.layout(420, 560, "CENTER");
		this.frame.setBlackBackground();
		this.frame.show();
	}
	onUnmount(): void {
		this.frame.hide();
	}
	getNavGrid(): [] {
		return [];
	}
	destroy(): void {
		this.frame.destroy();
	}
}
