import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NavGrid } from "../navigation/types";
import { Frame } from "./frame";

export interface ModalOption {
	readonly id: string;
	readonly label: string;
	select(): void;
}
export interface IModal {
	open(
		title: string,
		options: readonly ModalOption[],
		tooltipItem?: string | number,
	): void;
	close(): void;
}
export interface IModalNavigation {
	pushModal(id: string, grid: NavGrid, cancel: () => void): void;
	popModal(id: string): void;
}

/** Pooled, centered overlay with exclusive controller navigation. */
export class Modal implements IModal {
	private readonly backdrop: Frame;
	private readonly window: Frame;
	private readonly tooltip: Frame;
	private readonly divider: Frame;
	private readonly buttons: Frame[] = [];
	private opened = false;
	private readonly dismiss = () => this.close();
	constructor(
		private readonly id: string,
		private readonly pool: IFramePoolManager,
		private readonly navigation: IModalNavigation,
		private readonly events: IEventBus,
	) {
		this.backdrop = new Frame(`${id}-backdrop`, pool);
		this.window = new Frame(`${id}-window`, pool);
		this.tooltip = new Frame(`${id}-tooltip`, pool, "GameTooltip");
		this.divider = new Frame(`${id}-divider`, pool);
		events.subscribe("COMBAT_STARTED", this.dismiss);
	}
	open(
		title: string,
		options: readonly ModalOption[],
		tooltipItem?: string | number,
	): void {
		this.backdrop.modalBackdrop();
		this.backdrop.setColor(0, 0, 0, 0.65);
		this.backdrop.onClose(this.dismiss);
		this.window.setParent(this.backdrop);
		this.window.setModalLayer();
		this.window.setColor(0.06, 0.07, 0.1);
		this.window.setBorder([0.3, 0.34, 0.42, 1]);
		let width = 360;
		let height = 100 + options.length * 44;
		let optionWidth = 328;
		if (tooltipItem !== undefined) {
			const available = this.backdrop.getSize();
			const details = this.tooltip.showItemTooltip(
				this.window,
				tooltipItem,
				Math.max(1, available.width - 380),
				Math.max(1, available.height - 96),
			);
			width = details.width + 340;
			height = Math.max(height, details.height + 40);
			optionWidth = 260;
			this.divider.setParent(this.window);
			this.divider.setModalLayer();
			this.divider.layout(1, height - 40, "TOPRIGHT", this.window, -300, -20);
			this.divider.setColor(0.3, 0.34, 0.42, 0.6);
			this.divider.show();
		} else {
			this.tooltip.hide();
			this.divider.hide();
		}
		this.window.layout(width, height, "CENTER", this.backdrop);
		this.window.setLabel("title", title, "TOPRIGHT", -20, -20, 18, optionWidth);
		this.window.setLabel(
			"hint",
			"A: Select   B: Cancel",
			"BOTTOMRIGHT",
			-20,
			16,
			12,
			optionWidth,
		);
		const grid: NavGrid = [];
		options.forEach((option, index) => {
			let button = this.buttons.at(index);
			if (!button) {
				button = new Frame(`${this.id}-option-${index}`, this.pool, "Button");
				this.buttons.push(button);
			}
			button.setParent(this.window);
			button.setModalLayer();
			button.layout(
				optionWidth,
				36,
				"TOPRIGHT",
				this.window,
				-20,
				-58 - index * 44,
			);
			button.setColor(0.15, 0.18, 0.24);
			button.setLabel("label", option.label);
			const select = () => {
				if (!this.opened) return;
				this.close();
				option.select();
			};
			button.onClick((mouse) => {
				if (mouse === "LeftButton") select();
			});
			grid.push([button.navigationNode(`${this.id}-${option.id}`, select)]);
			button.show();
		});
		for (let i = options.length; i < this.buttons.length; i++)
			this.buttons.at(i)?.hide();
		this.opened = true;
		this.window.show();
		this.backdrop.show();
		this.navigation.pushModal(this.id, grid, this.dismiss);
	}
	close(): void {
		if (!this.opened) return;
		this.opened = false;
		this.tooltip.hide();
		this.navigation.popModal(this.id);
		this.backdrop.hide();
	}
	destroy(): void {
		this.close();
		this.events.unsubscribe("COMBAT_STARTED", this.dismiss);
		for (const button of this.buttons) button.destroy();
		this.buttons.length = 0;
		this.tooltip.destroy();
		this.divider.destroy();
		this.window.destroy();
		this.backdrop.destroy();
	}
}
