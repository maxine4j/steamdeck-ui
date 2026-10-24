import type { IEventBus } from "../../events/types";
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
	private readonly refreshPortraitTabs = () => {
		if (this.stack.length === 0) return;
		this.panels.forEach((panel, index) => {
			if (panel.iconPortrait)
				this.tabs
					.at(index)
					?.button.setPortraitIcon(
						panel.iconPortrait,
						32,
						32,
						this.position === "right" ? 2 : -2,
					);
		});
	};
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
		private readonly tabGroups: readonly (readonly string[])[] = [],
		private readonly events?: IEventBus,
		private readonly onFocused?: (frame: Frame, position: DockPosition) => void,
	) {
		this.events?.subscribe("CHARACTER_MODEL_CHANGED", this.refreshPortraitTabs);
		this.frame.dock(position, 500, position === "fullscreen" ? 20 : 0);
		this.frame.onClose(() => {
			if (this.stack.length === 0) return;
			this.releaseNavigation();
			const active = this.stack.at(-1);
			this.stack.length = 0;
			active?.onUnmount();
			active?.onContainerClosed?.();
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
		panel.setNavigationChanged?.((focusId) =>
			this.navigation?.refreshGrid(this.id, focusId),
		);
		this.focus();
	}
	private getPanelGroups(): IPanel[][] {
		const grouped = new Set<string>();
		const groups: IPanel[][] = [];
		for (const ids of this.tabGroups) {
			const group: IPanel[] = [];
			for (const id of ids) {
				const panel = this.panels.find((candidate) => candidate.id === id);
				if (panel && !grouped.has(id)) {
					group.push(panel);
					grouped.add(id);
				}
			}
			if (group.length > 0) groups.push(group);
		}
		const ungrouped = this.panels.filter((panel) => !grouped.has(panel.id));
		if (ungrouped.length > 0) groups.push(ungrouped);
		return groups;
	}
	private renderTabs(): void {
		const createTab = this.createTab;
		if (!createTab || this.position === "fullscreen") return;
		const edge = this.position === "left" ? "RIGHT" : "LEFT";
		const mirrored = this.position === "right";
		const x = mirrored ? -41 : 43;
		const groups = this.getPanelGroups();
		const offsets = new Map<string, number>();
		let offset = ((this.panels.length - 1) * 58 + (groups.length - 1) * 20) / 2;
		for (const group of groups) {
			for (const panel of group) {
				offsets.set(panel.id, offset);
				offset -= 58;
			}
			offset -= 20;
		}
		this.panels.forEach((panel, index) => {
			let tab = this.tabs.at(index);
			if (!tab) {
				tab = {
					border: createTab(`${this.id}-tab-border-${panel.id}`, false),
					button: createTab(`${this.id}-tab-${panel.id}`, true),
				};
				this.tabs.push(tab);
			}
			const y = offsets.get(panel.id) ?? 0;
			tab.border.setParent(this.frame);
			tab.border.layout(43, 55, edge, this.frame, x, y);
			const selected = this.stack.at(-1)?.id === panel.id;
			tab.border.setSideTabBackground(selected, mirrored);
			tab.button.setParent(tab.border);
			tab.button.layout(43, 55, "CENTER", tab.border);
			if (panel.iconPortrait)
				tab.button.setPortraitIcon(
					panel.iconPortrait,
					32,
					32,
					mirrored ? 2 : -2,
				);
			else if (panel.iconAtlas)
				tab.button.setAtlasIcon(panel.iconAtlas, 32, 32, mirrored ? 2 : -2);
			else {
				tab.button.setIcon(panel.icon ?? 134400);
				tab.button.setIconSize(32, 32, mirrored ? 2 : -2);
			}
			const border = tab.border;
			tab.button.setTooltip(panel.title, undefined, false, (hovered) =>
				border.setSideTabBackground(selected, mirrored, hovered),
			);
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
		if (this.stack.length === 0) return;
		this.releaseNavigation();
		const active = this.stack.pop();
		active?.onUnmount();
		const previous = this.stack.at(-1);
		if (previous) this.mount(previous);
		else {
			for (const tab of this.tabs) {
				tab.button.hide();
				tab.border.hide();
			}
			this.frame.hide();
			active?.onContainerClosed?.();
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
		if (active?.onPanelCycle) {
			active.onPanelCycle(direction);
			return;
		}
		if (this.position === "fullscreen") return;
		const orderedPanels = this.getPanelGroups().flat();
		if (!active || orderedPanels.length < 2) return;
		const index = orderedPanels.indexOf(active);
		const panel = orderedPanels.at(
			(index + direction + orderedPanels.length) % orderedPanels.length,
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
				onContainerSwitch: this.stack.at(-1)?.onContainerSwitch
					? (direction) => this.stack.at(-1)?.onContainerSwitch?.(direction)
					: undefined,
				onActiveChanged: (active) => {
					if (active) this.onFocused?.(this.frame, this.position);
					const panel = this.stack.at(-1);
					this.frame.setFocusBorder(active && !panel?.onActiveChanged);
					panel?.onActiveChanged?.(active);
				},
				onPanelCycle: (direction) => this.cyclePanel(direction),
				onCancel: () => {
					const panel = this.stack.at(-1);
					if (panel?.onBack) panel.onBack();
					else this.popPanel();
				},
			},
		);
		this.navigation?.setActiveGrid(this.id);
	}
	private releaseNavigation(): void {
		this.stack.at(-1)?.setNavigationChanged?.();
		this.navigation?.unregisterGrid(this.id);
	}
	clear(): void {
		this.events?.unsubscribe(
			"CHARACTER_MODEL_CHANGED",
			this.refreshPortraitTabs,
		);
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
