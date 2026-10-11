import type { Frame } from "../components/frame";
import type { DockPosition, IPanel, IPanelContainer } from "./types";
export class PanelContainer implements IPanelContainer {
	private readonly panels: IPanel[] = [];
	constructor(
		public readonly id: string,
		public readonly position: DockPosition,
		private readonly frame: Frame,
	) {
		this.frame.dock(position, 500);
	}
	pushPanel(panel: IPanel): void {
		this.panels.at(-1)?.onUnmount();
		this.frame.dock(this.position, 500);
		this.frame.show();
		this.panels.push(panel);
		panel.onMount(this.frame);
	}
	popPanel(): void {
		this.panels.pop()?.onUnmount();
		const previous = this.panels.at(-1);
		if (previous) previous.onMount(this.frame);
		else this.frame.hide();
	}
	swapPanel(panel: IPanel): void {
		this.popPanel();
		this.pushPanel(panel);
	}
	focus(): void {}
	clear(): void {
		while (this.panels.length > 0) this.popPanel();
		this.frame.destroy();
	}
}
