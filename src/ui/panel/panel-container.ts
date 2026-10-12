import type { Frame } from "../components/frame";
import type {
	GridNeighbors,
	INavManager,
} from "../navigation/navigation-manager";
import type { DockPosition, IPanel, IPanelContainer } from "./types";
export class PanelContainer implements IPanelContainer {
	private readonly panels: IPanel[] = [];
	private readonly tabs: { border: Frame; button: Frame }[] = [];
	private readonly stack: IPanel[] = [];
	get activePanelId(): string | undefined {
		return this.stack.at(-1)?.id;
	}
	constructor(
		public readonly id: string,
		public readonly position: DockPosition,
		private readonly frame: Frame,
		private readonly createTab?: (id: string, button: boolean) => Frame,
		private readonly onTabSelected?: (panel: IPanel) => void,
		private readonly navigation?: INavManager,
		private readonly navigationNeighbors?: GridNeighbors,
	) {
		this.frame.dock(position, 500);
		this.frame.onClose(() => {
			this.releaseNavigation();
			const active = this.stack.at(-1);
			this.stack.length = 0;
			active?.onUnmount();
			for (const tab of this.tabs) {
				tab.button.hide();
				tab.border.hide();
			}
		});
	}
	registerPanel(panel: IPanel): void {
		if (this.panels.some((existing) => existing.id === panel.id)) return;
		this.panels.push(panel);
		if (this.stack.length > 0) {
			this.renderTabs();
			this.navigation?.refreshGrid(this.id);
		}
	}
	pushPanel(panel: IPanel): void {
		this.registerPanel(panel);
		this.stack.at(-1)?.setNavigationChanged?.();
		this.stack.at(-1)?.onUnmount();
		this.stack.push(panel);
		this.mount(panel);
	}
	private mount(panel: IPanel): void {
		this.frame.show();
		this.renderTabs();
		panel.onMount(this.frame);
		panel.setNavigationChanged?.(() => this.navigation?.refreshGrid(this.id));
		this.focus();
	}
	private renderTabs(): void {
		const createTab = this.createTab;
		if (!createTab || this.position === "fullscreen") return;
		const edge = this.position === "left" ? "RIGHT" : "LEFT";
		const x = this.position === "left" ? 44 : -44;
		this.panels.forEach((panel, index) => {
			let tab = this.tabs.at(index);
			if (!tab) {
				tab = {
					border: createTab(`${this.id}-tab-border-${panel.id}`, false),
					button: createTab(`${this.id}-tab-${panel.id}`, true),
				};
				this.tabs.push(tab);
			}
			const y = ((this.panels.length - 1) / 2 - index) * 48;
			tab.border.setParent(this.frame);
			tab.border.layout(44, 44, edge, this.frame, x, y);
			const color: readonly [number, number, number] =
				this.stack.at(-1)?.id === panel.id ? [1, 0.82, 0] : [0.2, 0.2, 0.2];
			tab.border.setColor(...color);
			tab.button.setParent(tab.border);
			tab.button.layout(40, 40, "CENTER", tab.border);
			tab.button.setIcon(panel.icon ?? 134400);
			tab.button.setTooltip(panel.title);
			tab.button.onClick((button) => {
				if (button === "LeftButton" && this.stack.length > 0) {
					this.onTabSelected?.(panel);
					this.swapPanel(panel);
				}
			});
			tab.border.show();
			tab.button.show();
		});
	}
	popPanel(): void {
		this.releaseNavigation();
		this.stack.pop()?.onUnmount();
		const previous = this.stack.at(-1);
		if (previous) this.mount(previous);
		else {
			for (const tab of this.tabs) {
				tab.button.hide();
				tab.border.hide();
			}
			this.frame.hide();
		}
	}
	swapPanel(panel: IPanel): void {
		if (this.stack.at(-1) === panel) {
			this.focus();
			return;
		}
		this.stack.at(-1)?.setNavigationChanged?.();
		this.registerPanel(panel);
		this.stack.pop()?.onUnmount();
		this.stack.push(panel);
		this.mount(panel);
	}
	private cyclePanel(direction: -1 | 1): void {
		const active = this.stack.at(-1);
		if (!active || this.panels.length < 2) return;
		const index = this.panels.indexOf(active);
		const panel = this.panels.at(
			(index + direction + this.panels.length) % this.panels.length,
		);
		if (!panel) return;
		this.onTabSelected?.(panel);
		this.swapPanel(panel);
	}
	focus(): void {
		if (!this.stack.length) return;
		this.navigation?.registerGrid(
			this.id,
			() => this.stack.at(-1)?.getNavGrid() ?? [],
			{
				...this.navigationNeighbors,
				onActiveChanged: (active) => this.frame.setFocusBorder(active),
				onPanelCycle: (direction) => this.cyclePanel(direction),
			},
		);
		this.navigation?.setActiveGrid(this.id);
	}
	private releaseNavigation(): void {
		this.stack.at(-1)?.setNavigationChanged?.();
		this.navigation?.unregisterGrid(this.id);
	}
	clear(): void {
		this.releaseNavigation();
		this.stack.at(-1)?.onUnmount();
		this.stack.length = 0;
		for (const tab of this.tabs) {
			tab.button.destroy();
			tab.border.destroy();
		}
		this.tabs.length = 0;
		this.panels.length = 0;
		this.frame.destroy();
	}
}
