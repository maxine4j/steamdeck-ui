import type { PanelContainer } from "./panel/panel-container";
import type { DockPosition, IPanel, IPanelContainer } from "./panel/types";
export interface IUIOrchestrator {
	getContainer(position: DockPosition, containerId?: string): IPanelContainer;
	registerPanel(
		panel: IPanel,
		position?: DockPosition,
		containerId?: string,
	): void;
	openPanel(
		panelId: string,
		position: DockPosition,
		containerId?: string,
	): void;
	closePanel(
		position: DockPosition,
		panelId?: string,
		containerId?: string,
	): void;
}
export class UIOrchestrator implements IUIOrchestrator {
	private readonly panels = new Map<string, IPanel>();
	private readonly containers = new Map<string, PanelContainer>();
	constructor(
		private readonly createContainer: (
			position: DockPosition,
			containerId?: string,
		) => PanelContainer,
	) {
		this.getContainer("left");
		this.getContainer("right");
	}
	getContainer(
		position: DockPosition,
		containerId: string = position,
	): PanelContainer {
		let container = this.containers.get(containerId);
		if (!container) {
			container = this.createContainer(position, containerId);
			this.containers.set(containerId, container);
		}
		return container;
	}
	registerPanel(
		panel: IPanel,
		position?: DockPosition,
		containerId?: string,
	): void {
		if (this.panels.has(panel.id))
			throw new Error(`Duplicate panel: ${panel.id}`);
		this.panels.set(panel.id, panel);
		if (position) this.getContainer(position, containerId).registerPanel(panel);
	}
	openPanel(
		panelId: string,
		position: DockPosition,
		containerId?: string,
	): void {
		const panel = this.panels.get(panelId);
		if (!panel) throw new Error(`Unknown panel: ${panelId}`);
		const target = this.getContainer(position, containerId);
		for (const container of this.containers.values()) {
			if (
				container !== target &&
				(position === "fullscreen" || container.position === position)
			)
				while (container.activePanelId !== undefined) container.popPanel();
		}
		target.swapPanel(panel);
	}
	closePanel(
		position: DockPosition,
		panelId?: string,
		containerId: string = position,
	): void {
		const container = this.containers.get(containerId);
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
