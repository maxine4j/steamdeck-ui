import type { PanelContainer } from "./panel/panel-container";
import type { DockPosition, IPanel, IPanelContainer } from "./panel/types";
export interface IUIOrchestrator {
	getContainer(position: DockPosition): IPanelContainer;
	registerPanel(panel: IPanel, position?: DockPosition): void;
	openPanel(panelId: string, position: DockPosition): void;
	closePanel(position: DockPosition, panelId?: string): void;
}
export class UIOrchestrator implements IUIOrchestrator {
	private readonly panels = new Map<string, IPanel>();
	private readonly containers = new Map<DockPosition, PanelContainer>();
	constructor(
		private readonly createContainer: (
			position: DockPosition,
		) => PanelContainer,
	) {
		this.getContainer("left");
		this.getContainer("right");
	}
	getContainer(position: DockPosition): PanelContainer {
		let container = this.containers.get(position);
		if (!container) {
			container = this.createContainer(position);
			this.containers.set(position, container);
		}
		return container;
	}
	registerPanel(panel: IPanel, position?: DockPosition): void {
		if (this.panels.has(panel.id))
			throw new Error(`Duplicate panel: ${panel.id}`);
		this.panels.set(panel.id, panel);
		if (position) this.getContainer(position).registerPanel(panel);
	}
	openPanel(panelId: string, position: DockPosition): void {
		const panel = this.panels.get(panelId);
		if (!panel) throw new Error(`Unknown panel: ${panelId}`);
		this.getContainer(position).swapPanel(panel);
	}
	closePanel(position: DockPosition, panelId?: string): void {
		const container = this.containers.get(position);
		if (
			container &&
			(panelId === undefined || container.activePanelId === panelId)
		)
			container.popPanel();
	}
	destroy(): void {
		for (const container of this.containers.values()) container.clear();
		this.containers.clear();
	}
}
