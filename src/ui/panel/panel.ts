import type { Frame } from "../components/frame";
import type { IUIComponent } from "../components/types";
import { setWindowTitle } from "../components/window-title";
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
		this.frame.setWindowBackground();
		setWindowTitle(this.frame, this.title);
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
