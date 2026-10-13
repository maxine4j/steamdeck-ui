import type { IEventBus } from "../../events/types";
import type { IFramePoolManager } from "../frame-pool-manager";
import type { NavGrid } from "../navigation/types";
import { controllerIcon } from "./controller-icon";
import { Frame } from "./frame";
import type { TooltipContent } from "./tooltip-content";

export interface ModalOption {
	readonly id: string;
	readonly label: string;
	/** Secure toy activation takes place before select is called. */
	readonly toy?: number;
	select(): void;
}
export interface IModal {
	open(
		title: string,
		options: readonly ModalOption[],
		tooltipItem?: TooltipContent,
		titleAlignment?: "left" | "right",
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
	private readonly buttons = new Map<number, Frame>();
	private readonly actionButtons = new Map<number, Frame>();
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
		tooltipItem?: TooltipContent,
		titleAlignment: "left" | "right" = "right",
	): void {
		this.backdrop.modalBackdrop();
		this.backdrop.setColor(0, 0, 0, 0.65);
		this.backdrop.onClose(this.dismiss);
		this.window.setParent(this.backdrop);
		this.window.setModalLayer();
		this.window.setWindowBackground();
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
		this.window.setFocusBorder(true);
		this.window.setLabel(
			"title",
			title,
			titleAlignment === "left" ? "TOPLEFT" : "TOPRIGHT",
			titleAlignment === "left" ? 20 : -20,
			-20,
			18,
			optionWidth,
		);
		this.window.setLabel(
			"hint",
			`${controllerIcon("A")} Select   ${controllerIcon("B")} Cancel`,
			"BOTTOMRIGHT",
			-20,
			16,
			12,
			optionWidth,
		);
		const grid: NavGrid = [];
		for (const button of [
			...this.buttons.values(),
			...this.actionButtons.values(),
		])
			button.hide();
		options.forEach((option, index) => {
			const secure = option.toy !== undefined;
			const buttons = secure ? this.actionButtons : this.buttons;
			let button = buttons.get(index);
			if (!button) {
				button = new Frame(
					`${this.id}-${secure ? "action" : "option"}-${index}`,
					this.pool,
					secure ? "SecureButton" : "Button",
				);
				buttons.set(index, button);
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
			button.setButtonBackground();
			button.setLabel("label", option.label);
			const select = () => {
				if (!this.opened) return;
				this.close();
				option.select();
			};
			if (secure) {
				button.setToy(option.toy);
				button.onPostClick((mouse) => {
					if (mouse === "LeftButton") select();
				});
			} else {
				button.onClick((mouse) => {
					if (mouse === "LeftButton") select();
				});
			}
			const control = button;
			grid.push([
				{
					...button.navigationNode(
						`${this.id}-${option.id}`,
						secure ? () => {} : select,
					),
					secureActions: secure
						? () => ({ interact: this.opened ? control : undefined })
						: undefined,
				},
			]);
			button.show();
		});
		this.opened = true;
		this.window.show();
		this.backdrop.show();
		this.navigation.pushModal(this.id, grid, this.dismiss);
	}
	close(): void {
		if (!this.opened) return;
		this.opened = false;
		this.window.setFocusBorder(false);
		this.tooltip.hide();
		this.navigation.popModal(this.id);
		this.backdrop.hide();
	}
	destroy(): void {
		this.close();
		this.events.unsubscribe("COMBAT_STARTED", this.dismiss);
		for (const button of [
			...this.buttons.values(),
			...this.actionButtons.values(),
		])
			button.destroy();
		this.buttons.clear();
		this.actionButtons.clear();
		this.tooltip.destroy();
		this.divider.destroy();
		this.window.destroy();
		this.backdrop.destroy();
	}
}
